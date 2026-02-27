import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success, error } from '@/lib/api-response'
import { createAuditLog } from '@/lib/audit'
import { getCurrentUser } from '@/lib/auth'

interface RouteParams {
  params: Promise<{ id: string }>
}

// ==================== GET /api/assets/[id] ====================

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    const asset = await prisma.asset.findUnique({
      where: { id, deletedAt: null },
      include: {
        category: {
          select: {
            id: true,
            code: true,
            nameTr: true,
            nameRu: true,
            nameEn: true,
          },
        },
        worksite: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        assignments: {
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
          orderBy: { assignedDate: 'desc' },
        },
      },
    })

    if (!asset) {
      return error('NOT_FOUND', 404)
    }

    return success(asset)
  } catch (err) {
    console.error('GET /api/assets/[id] error:', err)
    return error('FETCH_FAILED', 500)
  }
}

// ==================== PUT /api/assets/[id] ====================

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser(request)
    if (!user) return error('UNAUTHORIZED', 401)

    const { id } = await params
    const body = await request.json()

    const existing = await prisma.asset.findUnique({
      where: { id, deletedAt: null },
    })

    if (!existing) {
      return error('NOT_FOUND', 404)
    }

    const asset = await prisma.asset.update({
      where: { id },
      data: {
        categoryId: body.categoryId ?? existing.categoryId,
        name: body.name ?? existing.name,
        brand: body.brand !== undefined ? body.brand : existing.brand,
        model: body.model !== undefined ? body.model : existing.model,
        serialNo: body.serialNo !== undefined ? body.serialNo : existing.serialNo,
        worksiteId: body.worksiteId !== undefined ? body.worksiteId : existing.worksiteId,
        status: body.status ?? existing.status,
        purchaseDate: body.purchaseDate !== undefined
          ? (body.purchaseDate ? new Date(body.purchaseDate) : null)
          : existing.purchaseDate,
        purchasePrice: body.purchasePrice !== undefined ? body.purchasePrice : existing.purchasePrice,
        depositAmount: body.depositAmount !== undefined ? body.depositAmount : existing.depositAmount,
        photoUrl: body.photoUrl !== undefined ? body.photoUrl : existing.photoUrl,
        notes: body.notes !== undefined ? body.notes : existing.notes,
      },
      include: {
        category: {
          select: {
            id: true,
            code: true,
            nameTr: true,
            nameRu: true,
            nameEn: true,
          },
        },
        worksite: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    })

    await createAuditLog({
      userId: user.id,
      action: 'UPDATE',
      entity: 'Asset',
      entityId: id,
      oldValues: existing,
      newValues: body,
    })

    return success(asset)
  } catch (err) {
    console.error('PUT /api/assets/[id] error:', err)
    return error('UPDATE_FAILED', 500)
  }
}

// ==================== DELETE /api/assets/[id] ====================
// Soft delete

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser(request)
    if (!user) return error('UNAUTHORIZED', 401)

    const { id } = await params

    const existing = await prisma.asset.findUnique({
      where: { id, deletedAt: null },
    })

    if (!existing) {
      return error('NOT_FOUND', 404)
    }

    await prisma.asset.update({
      where: { id },
      data: { deletedAt: new Date() },
    })

    await createAuditLog({
      userId: user.id,
      action: 'DELETE',
      entity: 'Asset',
      entityId: id,
      oldValues: existing,
    })

    return success({ message: 'Asset deleted successfully' })
  } catch (err) {
    console.error('DELETE /api/assets/[id] error:', err)
    return error('DELETE_FAILED', 500)
  }
}

// ==================== POST /api/assets/[id] ====================
// action=assign: Assign to employee
// action=return: Return from employee

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser(request)
    if (!user) return error('UNAUTHORIZED', 401)

    const { id } = await params
    const body = await request.json()

    const asset = await prisma.asset.findUnique({
      where: { id, deletedAt: null },
    })

    if (!asset) {
      return error('NOT_FOUND', 404)
    }

    if (body.action === 'assign') {
      if (!body.employeeId) {
        return error('EMPLOYEE_ID_REQUIRED', 400)
      }

      // Check if asset is available
      if (asset.status !== 'AVAILABLE') {
        return error('ASSET_NOT_AVAILABLE', 400)
      }

      // Check employee exists
      const employee = await prisma.employee.findUnique({
        where: { id: body.employeeId, deletedAt: null },
      })
      if (!employee) {
        return error('NOT_FOUND', 404)
      }

      const [assignment] = await prisma.$transaction([
        prisma.assetAssignment.create({
          data: {
            assetId: id,
            employeeId: body.employeeId,
            assignedDate: body.assignedDate ? new Date(body.assignedDate) : new Date(),
            notes: body.notes || null,
            createdById: user.id,
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
            asset: true,
          },
        }),
        prisma.asset.update({
          where: { id },
          data: { status: 'ASSIGNED' },
        }),
      ])

      await createAuditLog({
        userId: user.id,
        action: 'ASSIGN',
        entity: 'Asset',
        entityId: id,
        newValues: {
          employeeId: body.employeeId,
          assignedDate: assignment.assignedDate,
        },
      })

      return success(assignment, 201)
    }

    if (body.action === 'return') {
      // Find the active assignment
      const activeAssignment = await prisma.assetAssignment.findFirst({
        where: {
          assetId: id,
          returnDate: null,
        },
      })

      if (!activeAssignment) {
        return error('NO_ACTIVE_ASSIGNMENT', 400)
      }

      const [assignment] = await prisma.$transaction([
        prisma.assetAssignment.update({
          where: { id: activeAssignment.id },
          data: {
            returnDate: body.returnDate ? new Date(body.returnDate) : new Date(),
            returnStatus: body.returnStatus || 'GOOD',
            notes: body.notes !== undefined ? body.notes : activeAssignment.notes,
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
            asset: true,
          },
        }),
        prisma.asset.update({
          where: { id },
          data: { status: 'AVAILABLE' },
        }),
      ])

      await createAuditLog({
        userId: user.id,
        action: 'RETURN',
        entity: 'Asset',
        entityId: id,
        newValues: {
          returnDate: assignment.returnDate,
          returnStatus: assignment.returnStatus,
        },
      })

      return success(assignment)
    }

    return error('INVALID_ACTION', 400)
  } catch (err) {
    console.error('POST /api/assets/[id] error:', err)
    return error('ACTION_FAILED', 500)
  }
}
