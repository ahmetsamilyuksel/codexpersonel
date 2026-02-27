import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success, error } from '@/lib/api-response'
import { createAuditLog } from '@/lib/audit'
import { getCurrentUser } from '@/lib/auth'

interface RouteParams {
  params: Promise<{ id: string }>
}

// ==================== GET /api/transfers/[id] ====================

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    const transfer = await prisma.employeeSiteTransfer.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            employeeNo: true,
            firstName: true,
            lastName: true,
          },
        },
        fromWorksite: {
          select: { id: true, code: true, name: true, city: true },
        },
        toWorksite: {
          select: { id: true, code: true, name: true, city: true },
        },
      },
    })

    if (!transfer) {
      return error('NOT_FOUND', 404)
    }

    return success(transfer)
  } catch (err) {
    console.error('GET /api/transfers/[id] error:', err)
    return error('FETCH_FAILED', 500)
  }
}

// ==================== PUT /api/transfers/[id] ====================
// Approve or complete transfer

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser(request)
    if (!user) return error('UNAUTHORIZED', 401)

    const { id } = await params
    const body = await request.json()

    const existing = await prisma.employeeSiteTransfer.findUnique({
      where: { id },
    })

    if (!existing) {
      return error('NOT_FOUND', 404)
    }

    const updateData: Record<string, unknown> = {}

    if (body.status) {
      // Validate status transitions
      const validTransitions: Record<string, string[]> = {
        PENDING: ['APPROVED', 'REJECTED', 'CANCELLED'],
        APPROVED: ['COMPLETED', 'CANCELLED'],
        COMPLETED: [],
        REJECTED: [],
        CANCELLED: [],
      }

      const allowed = validTransitions[existing.status] || []
      if (!allowed.includes(body.status)) {
        return error('INVALID_STATUS_TRANSITION', 400)
      }

      updateData.status = body.status

      if (body.status === 'APPROVED') {
        updateData.approvedById = user.id
        updateData.approvedAt = new Date()
      }

      // When completing, update employee's worksite
      if (body.status === 'COMPLETED') {
        await prisma.employeeEmployment.updateMany({
          where: { employeeId: existing.employeeId },
          data: { worksiteId: existing.toWorksiteId },
        })
      }
    }

    if (body.reason !== undefined) updateData.reason = body.reason
    if (body.notes !== undefined) updateData.notes = body.notes
    if (body.accommodationEffect !== undefined) updateData.accommodationEffect = body.accommodationEffect
    if (body.salaryEffect !== undefined) updateData.salaryEffect = body.salaryEffect

    const transfer = await prisma.employeeSiteTransfer.update({
      where: { id },
      data: updateData,
      include: {
        employee: {
          select: {
            id: true,
            employeeNo: true,
            firstName: true,
            lastName: true,
          },
        },
        fromWorksite: {
          select: { id: true, code: true, name: true },
        },
        toWorksite: {
          select: { id: true, code: true, name: true },
        },
      },
    })

    await createAuditLog({
      userId: user.id,
      action: 'UPDATE',
      entity: 'EmployeeSiteTransfer',
      entityId: id,
      oldValues: { status: existing.status },
      newValues: updateData,
    })

    return success(transfer)
  } catch (err) {
    console.error('PUT /api/transfers/[id] error:', err)
    return error('UPDATE_FAILED', 500)
  }
}

// ==================== DELETE /api/transfers/[id] ====================

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser(request)
    if (!user) return error('UNAUTHORIZED', 401)

    const { id } = await params

    const existing = await prisma.employeeSiteTransfer.findUnique({
      where: { id },
    })

    if (!existing) {
      return error('NOT_FOUND', 404)
    }

    if (existing.status === 'COMPLETED') {
      return error('COMPLETED_NOT_DELETABLE', 400)
    }

    await prisma.employeeSiteTransfer.delete({ where: { id } })

    await createAuditLog({
      userId: user.id,
      action: 'DELETE',
      entity: 'EmployeeSiteTransfer',
      entityId: id,
      oldValues: existing,
    })

    return success({ message: 'Transfer deleted successfully' })
  } catch (err) {
    console.error('DELETE /api/transfers/[id] error:', err)
    return error('DELETE_FAILED', 500)
  }
}
