import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success, error } from '@/lib/api-response'
import { createAuditLog } from '@/lib/audit'
import { getCurrentUser } from '@/lib/auth'

interface RouteParams {
  params: Promise<{ id: string }>
}

// ==================== GET /api/hakkedis/[id] ====================
// Get hakkedis with items

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    const hakkedis = await prisma.hakkedis.findUnique({
      where: { id },
      include: {
        worksite: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        items: {
          include: {
            employee: {
              select: {
                id: true,
                employeeNo: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { date: 'asc' },
        },
      },
    })

    if (!hakkedis) {
      return error('NOT_FOUND', 404)
    }

    return success(hakkedis)
  } catch (err) {
    console.error('GET /api/hakkedis/[id] error:', err)
    return error('FETCH_FAILED', 500)
  }
}

// ==================== PUT /api/hakkedis/[id] ====================
// Update, add items

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser(request)
    if (!user) return error('UNAUTHORIZED', 401)

    const { id } = await params
    const body = await request.json()

    const existing = await prisma.hakkedis.findUnique({
      where: { id },
    })

    if (!existing) {
      return error('NOT_FOUND', 404)
    }

    const updateData: Record<string, unknown> = {}
    if (body.period !== undefined) updateData.period = body.period
    if (body.status !== undefined) updateData.status = body.status
    if (body.totalAmount !== undefined) updateData.totalAmount = body.totalAmount
    if (body.notes !== undefined) updateData.notes = body.notes

    const hakkedis = await prisma.hakkedis.update({
      where: { id },
      data: updateData,
      include: {
        worksite: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        items: {
          include: {
            employee: {
              select: {
                id: true,
                employeeNo: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { date: 'asc' },
        },
      },
    })

    await createAuditLog({
      userId: user.id,
      action: 'UPDATE',
      entity: 'Hakkedis',
      entityId: id,
      oldValues: existing,
      newValues: updateData,
    })

    return success(hakkedis)
  } catch (err) {
    console.error('PUT /api/hakkedis/[id] error:', err)
    return error('UPDATE_FAILED', 500)
  }
}

// ==================== POST /api/hakkedis/[id] ====================
// action=addItem: Add line item

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser(request)
    if (!user) return error('UNAUTHORIZED', 401)

    const { id } = await params
    const body = await request.json()

    if (body.action !== 'addItem') {
      return error('INVALID_ACTION', 400)
    }

    const hakkedis = await prisma.hakkedis.findUnique({
      where: { id },
    })

    if (!hakkedis) {
      return error('NOT_FOUND', 404)
    }

    const { workItem, unit, quantity, unitPrice, date } = body

    if (!workItem || !unit || quantity === undefined || unitPrice === undefined || !date) {
      return error('FIELDS_REQUIRED', 400)
    }

    const totalAmount = Number(quantity) * Number(unitPrice)

    const item = await prisma.$transaction(async (tx: any) => {
      const satir = await tx.hakkedisSatir.create({
        data: {
          hakkediId: id,
          employeeId: body.employeeId || null,
          workItem,
          unit,
          quantity,
          unitPrice,
          totalAmount,
          teamName: body.teamName || null,
          distributionPercent: body.distributionPercent ?? null,
          distributionAmount: body.distributionAmount ?? null,
          date: new Date(date),
          notes: body.notes || null,
        },
        include: {
          employee: {
            select: {
              id: true,
              employeeNo: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      })

      // Recalculate hakkedis total
      const allItems = await tx.hakkedisSatir.findMany({
        where: { hakkediId: id },
      })

      const newTotal = allItems.reduce(
        (sum: number, item: any) => sum + Number(item.totalAmount),
        0
      )

      await tx.hakkedis.update({
        where: { id },
        data: { totalAmount: Math.round(newTotal * 100) / 100 },
      })

      return satir
    })

    await createAuditLog({
      userId: user.id,
      action: 'ADD_ITEM',
      entity: 'Hakkedis',
      entityId: id,
      newValues: { itemId: item.id, workItem, totalAmount },
    })

    return success(item, 201)
  } catch (err) {
    console.error('POST /api/hakkedis/[id] error:', err)
    return error('CREATE_FAILED', 500)
  }
}

// ==================== DELETE /api/hakkedis/[id] ====================

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser(request)
    if (!user) return error('UNAUTHORIZED', 401)

    const { id } = await params

    const existing = await prisma.hakkedis.findUnique({
      where: { id },
      include: {
        items: { select: { id: true } },
      },
    })

    if (!existing) {
      return error('NOT_FOUND', 404)
    }

    if (existing.status !== 'DRAFT') {
      return error('ONLY_DRAFT_DELETABLE', 400)
    }

    // Cascade delete items (handled by Prisma onDelete: Cascade) and then hakkedis
    await prisma.hakkedis.delete({ where: { id } })

    await createAuditLog({
      userId: user.id,
      action: 'DELETE',
      entity: 'Hakkedis',
      entityId: id,
      oldValues: existing,
    })

    return success({ message: 'Hakkedis deleted successfully' })
  } catch (err) {
    console.error('DELETE /api/hakkedis/[id] error:', err)
    return error('DELETE_FAILED', 500)
  }
}
