import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success, error } from '@/lib/api-response'
import { createAuditLog } from '@/lib/audit'
import { getCurrentUser } from '@/lib/auth'

interface RouteParams {
  params: Promise<{ id: string }>
}

// ==================== GET /api/leaves/[id] ====================

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    const leaveRequest = await prisma.leaveRequest.findUnique({
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
        leaveType: {
          select: {
            id: true,
            code: true,
            nameTr: true,
            nameRu: true,
            nameEn: true,
            isPaid: true,
          },
        },
      },
    })

    if (!leaveRequest) {
      return error('NOT_FOUND', 404)
    }

    return success(leaveRequest)
  } catch (err) {
    console.error('GET /api/leaves/[id] error:', err)
    return error('FETCH_FAILED', 500)
  }
}

// ==================== PUT /api/leaves/[id] ====================
// Approve or reject leave request

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser(request)
    if (!user) return error('UNAUTHORIZED', 401)

    const { id } = await params
    const body = await request.json()

    const existing = await prisma.leaveRequest.findUnique({
      where: { id },
    })

    if (!existing) {
      return error('NOT_FOUND', 404)
    }

    const updateData: Record<string, unknown> = {}

    if (body.status) {
      // Validate status transitions
      const validTransitions: Record<string, string[]> = {
        PENDING: ['APPROVED', 'REJECTED'],
        APPROVED: ['CANCELLED'],
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

      // If rejecting or cancelling, restore the balance
      if (body.status === 'REJECTED' || body.status === 'CANCELLED') {
        const startYear = existing.startDate.getFullYear()

        await prisma.leaveBalance.update({
          where: {
            employeeId_leaveTypeId_year: {
              employeeId: existing.employeeId,
              leaveTypeId: existing.leaveTypeId,
              year: startYear,
            },
          },
          data: {
            used: { decrement: Number(existing.totalDays) },
            remaining: { increment: Number(existing.totalDays) },
          },
        })
      }
    }

    if (body.notes !== undefined) {
      updateData.notes = body.notes
    }

    const leaveRequest = await prisma.leaveRequest.update({
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
        leaveType: {
          select: {
            id: true,
            code: true,
            nameTr: true,
            nameRu: true,
            nameEn: true,
            isPaid: true,
          },
        },
      },
    })

    await createAuditLog({
      userId: user.id,
      action: 'UPDATE',
      entity: 'LeaveRequest',
      entityId: id,
      oldValues: { status: existing.status },
      newValues: updateData,
    })

    return success(leaveRequest)
  } catch (err) {
    console.error('PUT /api/leaves/[id] error:', err)
    return error('UPDATE_FAILED', 500)
  }
}

// ==================== DELETE /api/leaves/[id] ====================
// Cancel leave request

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser(request)
    if (!user) return error('UNAUTHORIZED', 401)

    const { id } = await params

    const existing = await prisma.leaveRequest.findUnique({
      where: { id },
    })

    if (!existing) {
      return error('NOT_FOUND', 404)
    }

    if (existing.status !== 'PENDING') {
      return error('ONLY_PENDING_CANCELLABLE', 400)
    }

    // Restore balance
    const startYear = existing.startDate.getFullYear()

    await prisma.$transaction([
      prisma.leaveRequest.update({
        where: { id },
        data: { status: 'CANCELLED' },
      }),
      prisma.leaveBalance.update({
        where: {
          employeeId_leaveTypeId_year: {
            employeeId: existing.employeeId,
            leaveTypeId: existing.leaveTypeId,
            year: startYear,
          },
        },
        data: {
          used: { decrement: Number(existing.totalDays) },
          remaining: { increment: Number(existing.totalDays) },
        },
      }),
    ])

    await createAuditLog({
      userId: user.id,
      action: 'CANCEL',
      entity: 'LeaveRequest',
      entityId: id,
      oldValues: { status: existing.status },
      newValues: { status: 'CANCELLED' },
    })

    return success({ message: 'Leave request cancelled successfully' })
  } catch (err) {
    console.error('DELETE /api/leaves/[id] error:', err)
    return error('DELETE_FAILED', 500)
  }
}
