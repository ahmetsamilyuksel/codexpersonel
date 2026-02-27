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

    const [data, total] = await Promise.all([
      prisma.deductionCategory.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sort]: order },
      }),
      prisma.deductionCategory.count({ where }),
    ])

    return paginated(data, total, page, limit)
  } catch (err) {
    console.error('GET /api/deduction-categories error:', err)
    return error('FETCH_FAILED', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.code || !body.nameTr || !body.nameRu || !body.nameEn) {
      return error('FIELDS_REQUIRED')
    }

    const existing = await prisma.deductionCategory.findUnique({
      where: { code: body.code },
    })
    if (existing) {
      return error('ALREADY_EXISTS', 409)
    }

    const item = await prisma.deductionCategory.create({
      data: {
        code: body.code,
        nameTr: body.nameTr,
        nameRu: body.nameRu,
        nameEn: body.nameEn,
        isActive: body.isActive ?? true,
        sortOrder: body.sortOrder ?? 0,
      },
    })

    await createAuditLog({
      action: 'CREATE',
      entity: 'DeductionCategory',
      entityId: item.id,
      newValues: body,
    })

    return success(item, 201)
  } catch (err) {
    console.error('POST /api/deduction-categories error:', err)
    return error('CREATE_FAILED', 500)
  }
}
