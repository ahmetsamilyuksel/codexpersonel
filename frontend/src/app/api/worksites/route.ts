import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success, error, paginated } from '@/lib/api-response'
import { createAuditLog } from '@/lib/audit'
import { getCurrentUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = { deletedAt: null }
    if (status) where.status = status
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [data, total] = await Promise.all([
      prisma.worksite.findMany({
        where: where as any,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              employments: true,
              assets: true,
            },
          },
        },
      }),
      prisma.worksite.count({ where: where as any }),
    ])

    return paginated(data, total, page, limit)
  } catch (err) {
    console.error('Worksites list error:', err)
    return error('Failed to fetch worksites', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) return error('Unauthorized', 401)

    const body = await request.json()
    const { code, name } = body

    if (!code || !name) {
      return error('Code and name are required', 400)
    }

    const existing = await prisma.worksite.findUnique({ where: { code } })
    if (existing) return error('Worksite code already exists', 409)

    const worksite = await prisma.worksite.create({
      data: {
        code: body.code,
        name: body.name,
        address: body.address || null,
        city: body.city || null,
        region: body.region || null,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        projectManager: body.projectManager || null,
        siteManager: body.siteManager || null,
        client: body.client || null,
        status: body.status || 'ACTIVE',
        notes: body.notes || null,
      },
    })

    await createAuditLog({
      userId: user.id,
      action: 'CREATE',
      entity: 'Worksite',
      entityId: worksite.id,
      newValues: body,
    })

    return success(worksite, 201)
  } catch (err) {
    console.error('Create worksite error:', err)
    return error('Failed to create worksite', 500)
  }
}
