import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success, error, paginated } from '@/lib/api-response'
import { createAuditLog } from '@/lib/audit'
import { getCurrentUser } from '@/lib/auth'

// ==================== GET /api/attendance/periods ====================
// List attendance periods

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const worksiteId = searchParams.get('worksiteId') || ''
    const status = searchParams.get('status') || ''
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (worksiteId) where.worksiteId = worksiteId
    if (status) where.status = status

    const [data, total] = await Promise.all([
      prisma.attendancePeriod.findMany({
        where: where as any,
        skip,
        take: limit,
        orderBy: [{ period: 'desc' }],
        include: {
          worksite: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          _count: {
            select: { records: true },
          },
        },
      }),
      prisma.attendancePeriod.count({ where: where as any }),
    ])

    return paginated(data, total, page, limit)
  } catch (err) {
    console.error('GET /api/attendance/periods error:', err)
    return error('Failed to fetch attendance periods', 500)
  }
}

// ==================== POST /api/attendance/periods ====================
// Create period for worksite+month

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) return error('Unauthorized', 401)

    const body = await request.json()
    const { period, worksiteId } = body

    if (!period) {
      return error('Period is required (e.g. 2025-01)', 400)
    }

    // Check if period already exists for this worksite
    const existing = await prisma.attendancePeriod.findUnique({
      where: {
        period_worksiteId: {
          period,
          worksiteId: worksiteId || null,
        },
      },
    })

    if (existing) {
      return error('An attendance period already exists for this worksite and month', 409)
    }

    const attendancePeriod = await prisma.attendancePeriod.create({
      data: {
        period,
        worksiteId: worksiteId || null,
        status: 'OPEN',
      },
      include: {
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
      action: 'CREATE',
      entity: 'AttendancePeriod',
      entityId: attendancePeriod.id,
      newValues: body,
    })

    return success(attendancePeriod, 201)
  } catch (err) {
    console.error('POST /api/attendance/periods error:', err)
    return error('Failed to create attendance period', 500)
  }
}

// ==================== PUT /api/attendance/periods ====================
// Update period status (OPEN->SUBMITTED->APPROVED->LOCKED)

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) return error('Unauthorized', 401)

    const body = await request.json()
    const { id, status } = body

    if (!id || !status) {
      return error('Fields id and status are required', 400)
    }

    const existing = await prisma.attendancePeriod.findUnique({
      where: { id },
    })

    if (!existing) {
      return error('Attendance period not found', 404)
    }

    // Validate status transitions
    const validTransitions: Record<string, string[]> = {
      OPEN: ['SUBMITTED'],
      SUBMITTED: ['APPROVED', 'OPEN'],
      APPROVED: ['LOCKED', 'SUBMITTED'],
      LOCKED: [],
    }

    const allowed = validTransitions[existing.status] || []
    if (!allowed.includes(status)) {
      return error(`Cannot transition from ${existing.status} to ${status}`, 400)
    }

    const updateData: Record<string, unknown> = { status }

    if (status === 'SUBMITTED') {
      updateData.submittedById = user.id
      updateData.submittedAt = new Date()
    } else if (status === 'APPROVED') {
      updateData.approvedById = user.id
      updateData.approvedAt = new Date()
    }

    const period = await prisma.attendancePeriod.update({
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
        _count: {
          select: { records: true },
        },
      },
    })

    await createAuditLog({
      userId: user.id,
      action: 'UPDATE',
      entity: 'AttendancePeriod',
      entityId: id,
      oldValues: { status: existing.status },
      newValues: { status },
    })

    return success(period)
  } catch (err) {
    console.error('PUT /api/attendance/periods error:', err)
    return error('Failed to update attendance period', 500)
  }
}
