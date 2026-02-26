import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success, error, paginated } from '@/lib/api-response'
import { createAuditLog } from '@/lib/audit'
import { getCurrentUser } from '@/lib/auth'

// ==================== GET /api/hakkedis ====================
// List hakkedis with filters (worksiteId, period, status)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const worksiteId = searchParams.get('worksiteId') || ''
    const period = searchParams.get('period') || ''
    const status = searchParams.get('status') || ''
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (worksiteId) where.worksiteId = worksiteId
    if (period) where.period = period
    if (status) where.status = status

    const [data, total] = await Promise.all([
      prisma.hakkedis.findMany({
        where: where as any,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          worksite: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          _count: {
            select: { items: true },
          },
        },
      }),
      prisma.hakkedis.count({ where: where as any }),
    ])

    return paginated(data, total, page, limit)
  } catch (err) {
    console.error('GET /api/hakkedis error:', err)
    return error('Failed to fetch hakkedis', 500)
  }
}

// ==================== POST /api/hakkedis ====================
// Create hakkedis

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) return error('Unauthorized', 401)

    const body = await request.json()
    const { worksiteId } = body

    if (!worksiteId) {
      return error('worksiteId is required', 400)
    }

    // Verify worksite exists
    const worksite = await prisma.worksite.findUnique({
      where: { id: worksiteId },
    })
    if (!worksite) {
      return error('Worksite not found', 404)
    }

    const hakkedis = await prisma.hakkedis.create({
      data: {
        worksiteId,
        period: body.period || null,
        status: body.status || 'DRAFT',
        totalAmount: body.totalAmount ?? 0,
        notes: body.notes || null,
        createdById: user.id,
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
      entity: 'Hakkedis',
      entityId: hakkedis.id,
      newValues: body,
    })

    return success(hakkedis, 201)
  } catch (err) {
    console.error('POST /api/hakkedis error:', err)
    return error('Failed to create hakkedis', 500)
  }
}
