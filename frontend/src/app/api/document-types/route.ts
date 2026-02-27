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
    const category = searchParams.get('category') || ''
    const skip = (page - 1) * limit

    const where: any = {}

    if (search) {
      where.OR = [
        { nameTr: { contains: search, mode: 'insensitive' as const } },
        { nameRu: { contains: search, mode: 'insensitive' as const } },
        { nameEn: { contains: search, mode: 'insensitive' as const } },
        { code: { contains: search, mode: 'insensitive' as const } },
      ]
    }

    if (category) {
      where.category = category
    }

    const [data, total] = await Promise.all([
      prisma.documentType.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sort]: order },
        include: {
          requirements: true,
        },
      }),
      prisma.documentType.count({ where }),
    ])

    return paginated(data, total, page, limit)
  } catch (err) {
    console.error('GET /api/document-types error:', err)
    return error('FETCH_FAILED', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.code || !body.nameTr || !body.nameRu || !body.nameEn) {
      return error('FIELDS_REQUIRED')
    }

    const existing = await prisma.documentType.findUnique({
      where: { code: body.code },
    })
    if (existing) {
      return error('ALREADY_EXISTS', 409)
    }

    const item = await prisma.documentType.create({
      data: {
        code: body.code,
        nameTr: body.nameTr,
        nameRu: body.nameRu,
        nameEn: body.nameEn,
        category: body.category || null,
        hasExpiry: body.hasExpiry ?? false,
        defaultAlertDays: body.defaultAlertDays ?? 30,
        isActive: body.isActive ?? true,
        sortOrder: body.sortOrder ?? 0,
      },
    })

    await createAuditLog({
      action: 'CREATE',
      entity: 'DocumentType',
      entityId: item.id,
      newValues: body,
    })

    return success(item, 201)
  } catch (err) {
    console.error('POST /api/document-types error:', err)
    return error('CREATE_FAILED', 500)
  }
}
