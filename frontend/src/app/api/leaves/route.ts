import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success, error, paginated } from '@/lib/api-response'
import { createAuditLog } from '@/lib/audit'
import { getCurrentUser } from '@/lib/auth'

// ==================== GET /api/leaves ====================
// List leave requests with filters

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const employeeId = searchParams.get('employeeId') || ''
    const leaveTypeId = searchParams.get('leaveTypeId') || ''
    const status = searchParams.get('status') || ''
    const dateFrom = searchParams.get('dateFrom') || ''
    const dateTo = searchParams.get('dateTo') || ''
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (employeeId) where.employeeId = employeeId
    if (leaveTypeId) where.leaveTypeId = leaveTypeId
    if (status) where.status = status

    if (dateFrom || dateTo) {
      const dateFilter: Record<string, unknown> = {}
      if (dateFrom) dateFilter.gte = new Date(dateFrom)
      if (dateTo) dateFilter.lte = new Date(dateTo)
      where.startDate = dateFilter
    }

    const [data, total] = await Promise.all([
      prisma.leaveRequest.findMany({
        where: where as any,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
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
      }),
      prisma.leaveRequest.count({ where: where as any }),
    ])

    return paginated(data, total, page, limit)
  } catch (err) {
    console.error('GET /api/leaves error:', err)
    return error('FETCH_FAILED', 500)
  }
}

// ==================== POST /api/leaves ====================
// Create leave request, update balance

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) return error('UNAUTHORIZED', 401)

    const body = await request.json()
    const { employeeId, leaveTypeId, startDate, endDate, totalDays, reason } = body

    if (!employeeId || !leaveTypeId || !startDate || !endDate || !totalDays) {
      return error('FIELDS_REQUIRED', 400)
    }

    // Verify employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId, deletedAt: null },
    })
    if (!employee) {
      return error('NOT_FOUND', 404)
    }

    // Verify leave type exists
    const leaveType = await prisma.leaveType.findUnique({
      where: { id: leaveTypeId },
    })
    if (!leaveType) {
      return error('NOT_FOUND', 404)
    }

    // Check for overlapping leave requests
    const overlapping = await prisma.leaveRequest.findFirst({
      where: {
        employeeId,
        status: { in: ['PENDING', 'APPROVED'] },
        startDate: { lte: new Date(endDate) },
        endDate: { gte: new Date(startDate) },
      },
    })

    if (overlapping) {
      return error('OVERLAPPING_LEAVE', 409)
    }

    const startYear = new Date(startDate).getFullYear()

    const leaveRequest = await prisma.$transaction(async (tx: any) => {
      // Create the leave request
      const request = await tx.leaveRequest.create({
        data: {
          employeeId,
          leaveTypeId,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          totalDays,
          reason: reason || null,
          status: 'PENDING',
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

      // Update leave balance (upsert for the year)
      await tx.leaveBalance.upsert({
        where: {
          employeeId_leaveTypeId_year: {
            employeeId,
            leaveTypeId,
            year: startYear,
          },
        },
        create: {
          employeeId,
          leaveTypeId,
          year: startYear,
          entitled: leaveType.maxDaysYear || 0,
          used: totalDays,
          remaining: (leaveType.maxDaysYear || 0) - totalDays,
        },
        update: {
          used: { increment: totalDays },
          remaining: { decrement: totalDays },
        },
      })

      return request
    })

    await createAuditLog({
      userId: user.id,
      action: 'CREATE',
      entity: 'LeaveRequest',
      entityId: leaveRequest.id,
      newValues: body,
    })

    return success(leaveRequest, 201)
  } catch (err) {
    console.error('POST /api/leaves error:', err)
    return error('CREATE_FAILED', 500)
  }
}
