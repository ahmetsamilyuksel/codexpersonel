import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success, error, paginated } from '@/lib/api-response'
import { createAuditLog } from '@/lib/audit'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const search = searchParams.get('search') || ''
    const sort = searchParams.get('sort') || 'sortOrder'
    const order = searchParams.get('order') || 'asc'
    const tree = searchParams.get('tree') === 'true'
    const skip = (page - 1) * limit

    const where = search
      ? {
          OR: [
            { nameTr: { contains: search, mode: 'insensitive' as const } },
            { nameRu: { contains: search, mode: 'insensitive' as const } },
            { nameEn: { contains: search, mode: 'insensitive' as const } },
            { code: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}

    if (tree) {
      const data = await prisma.department.findMany({
        where: { parentId: null, ...where },
        include: {
          children: {
            include: {
              children: {
                include: {
                  children: true,
                },
              },
            },
          },
        },
        orderBy: { [sort]: order },
      })
      return success(data)
    }

    const [data, total] = await Promise.all([
      prisma.department.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sort]: order },
        include: {
          parent: { select: { id: true, code: true, nameTr: true, nameRu: true, nameEn: true } },
          children: { select: { id: true, code: true, nameTr: true, nameRu: true, nameEn: true } },
        },
      }),
      prisma.department.count({ where }),
    ])

    return paginated(data, total, page, limit)
  } catch (err) {
    console.error('GET /api/departments error:', err)
    return error('FETCH_FAILED', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.code || !body.nameTr || !body.nameRu || !body.nameEn) {
      return error('FIELDS_REQUIRED')
    }

    const existing = await prisma.department.findUnique({
      where: { code: body.code },
    })
    if (existing) {
      return error('ALREADY_EXISTS', 409)
    }

    if (body.parentId) {
      const parent = await prisma.department.findUnique({
        where: { id: body.parentId },
      })
      if (!parent) {
        return error('NOT_FOUND', 404)
      }
    }

    const item = await prisma.department.create({
      data: {
        code: body.code,
        nameTr: body.nameTr,
        nameRu: body.nameRu,
        nameEn: body.nameEn,
        parentId: body.parentId || null,
        isActive: body.isActive ?? true,
        sortOrder: body.sortOrder ?? 0,
      },
      include: {
        parent: { select: { id: true, code: true, nameTr: true, nameRu: true, nameEn: true } },
      },
    })

    await createAuditLog({
      action: 'CREATE',
      entity: 'Department',
      entityId: item.id,
      newValues: body,
    })

    return success(item, 201)
  } catch (err) {
    console.error('POST /api/departments error:', err)
    return error('CREATE_FAILED', 500)
  }
}
