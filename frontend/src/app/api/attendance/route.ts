import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success, error, paginated } from '@/lib/api-response'
import { createAuditLog } from '@/lib/audit'
import { getCurrentUser } from '@/lib/auth'

// ==================== GET /api/attendance ====================
// List attendance records, filter by employeeId, worksiteId, date range, periodId

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const employeeId = searchParams.get('employeeId') || ''
    const worksiteId = searchParams.get('worksiteId') || ''
    const periodId = searchParams.get('periodId') || ''
    const dateFrom = searchParams.get('dateFrom') || ''
    const dateTo = searchParams.get('dateTo') || ''
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (employeeId) where.employeeId = employeeId
    if (worksiteId) where.worksiteId = worksiteId
    if (periodId) where.periodId = periodId

    if (dateFrom || dateTo) {
      const dateFilter: Record<string, unknown> = {}
      if (dateFrom) dateFilter.gte = new Date(dateFrom)
      if (dateTo) dateFilter.lte = new Date(dateTo)
      where.date = dateFilter
    }

    const [data, total] = await Promise.all([
      prisma.attendanceRecord.findMany({
        where: where as any,
        skip,
        take: limit,
        orderBy: [{ date: 'desc' }, { employee: { lastName: 'asc' } }],
        include: {
          employee: {
            select: {
              id: true,
              employeeNo: true,
              firstName: true,
              lastName: true,
            },
          },
          worksite: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          period: {
            select: {
              id: true,
              period: true,
              status: true,
            },
          },
        },
      }),
      prisma.attendanceRecord.count({ where: where as any }),
    ])

    return paginated(data, total, page, limit)
  } catch (err) {
    console.error('GET /api/attendance error:', err)
    return error('Failed to fetch attendance records', 500)
  }
}

// ==================== POST /api/attendance ====================
// Create/upsert attendance record (upsert on employeeId+date)
// Support bulk POST (array of records for batch entry)

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) return error('Unauthorized', 401)

    const body = await request.json()

    // Normalize to array for bulk support
    const records = Array.isArray(body) ? body : [body]

    if (records.length === 0) {
      return error('At least one attendance record is required', 400)
    }

    const results = await prisma.$transaction(async (tx: any) => {
      const upserted = []

      for (const record of records) {
        if (!record.employeeId || !record.date) {
          continue
        }

        const dateValue = new Date(record.date)

        const attendance = await tx.attendanceRecord.upsert({
          where: {
            employeeId_date: {
              employeeId: record.employeeId,
              date: dateValue,
            },
          },
          create: {
            employeeId: record.employeeId,
            date: dateValue,
            periodId: record.periodId || null,
            checkIn: record.checkIn ? new Date(record.checkIn) : null,
            checkOut: record.checkOut ? new Date(record.checkOut) : null,
            totalHours: record.totalHours ?? 0,
            overtimeHours: record.overtimeHours ?? 0,
            nightHours: record.nightHours ?? 0,
            attendanceType: record.attendanceType || 'NORMAL',
            worksiteId: record.worksiteId || null,
            notes: record.notes || null,
            createdById: user.id,
          },
          update: {
            periodId: record.periodId !== undefined ? record.periodId : undefined,
            checkIn: record.checkIn !== undefined ? (record.checkIn ? new Date(record.checkIn) : null) : undefined,
            checkOut: record.checkOut !== undefined ? (record.checkOut ? new Date(record.checkOut) : null) : undefined,
            totalHours: record.totalHours !== undefined ? record.totalHours : undefined,
            overtimeHours: record.overtimeHours !== undefined ? record.overtimeHours : undefined,
            nightHours: record.nightHours !== undefined ? record.nightHours : undefined,
            attendanceType: record.attendanceType !== undefined ? record.attendanceType : undefined,
            worksiteId: record.worksiteId !== undefined ? record.worksiteId : undefined,
            notes: record.notes !== undefined ? record.notes : undefined,
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

        upserted.push(attendance)
      }

      return upserted
    })

    await createAuditLog({
      userId: user.id,
      action: 'UPSERT',
      entity: 'AttendanceRecord',
      newValues: { count: results.length },
    })

    // Return single object if single input, array if bulk
    return success(Array.isArray(body) ? results : results[0], 201)
  } catch (err) {
    console.error('POST /api/attendance error:', err)
    return error('Failed to create attendance record', 500)
  }
}
