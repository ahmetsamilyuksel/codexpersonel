import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success, error, paginated } from '@/lib/api-response'
import { getCurrentUser } from '@/lib/auth'

// ==================== GET /api/audit-logs ====================
// List audit logs with filters (entity, entityId, userId, action, dateRange)
// Paginated, sorted by createdAt desc

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) return error('UNAUTHORIZED', 401)

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const entity = searchParams.get('entity') || ''
    const entityId = searchParams.get('entityId') || ''
    const userId = searchParams.get('userId') || ''
    const action = searchParams.get('action') || ''
    const dateFrom = searchParams.get('dateFrom') || ''
    const dateTo = searchParams.get('dateTo') || ''
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (entity) where.entity = entity
    if (entityId) where.entityId = entityId
    if (userId) where.userId = userId
    if (action) where.action = action

    if (dateFrom || dateTo) {
      const dateFilter: Record<string, unknown> = {}
      if (dateFrom) dateFilter.gte = new Date(dateFrom)
      if (dateTo) dateFilter.lte = new Date(dateTo)
      where.createdAt = dateFilter
    }

    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: where as any,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      prisma.auditLog.count({ where: where as any }),
    ])

    return paginated(data, total, page, limit)
  } catch (err) {
    console.error('GET /api/audit-logs error:', err)
    return error('FETCH_FAILED', 500)
  }
}
