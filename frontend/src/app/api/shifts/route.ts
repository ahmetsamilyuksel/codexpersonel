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
    const sort = searchParams.get('sort') || 'code'
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
      prisma.shift.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sort]: order },
      }),
      prisma.shift.count({ where }),
    ])

    return paginated(data, total, page, limit)
  } catch (err) {
    console.error('GET /api/shifts error:', err)
    return error('FETCH_FAILED', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.code || !body.nameTr || !body.nameRu || !body.nameEn) {
      return error('FIELDS_REQUIRED')
    }

    if (!body.startTime || !body.endTime) {
      return error('FIELDS_REQUIRED')
    }

    const existing = await prisma.shift.findUnique({
      where: { code: body.code },
    })
    if (existing) {
      return error('ALREADY_EXISTS', 409)
    }

    const item = await prisma.shift.create({
      data: {
        code: body.code,
        nameTr: body.nameTr,
        nameRu: body.nameRu,
        nameEn: body.nameEn,
        startTime: body.startTime,
        endTime: body.endTime,
        breakMinutes: body.breakMinutes ?? 60,
        isNightShift: body.isNightShift ?? false,
        isActive: body.isActive ?? true,
      },
    })

    await createAuditLog({
      action: 'CREATE',
      entity: 'Shift',
      entityId: item.id,
      newValues: body,
    })

    return success(item, 201)
  } catch (err) {
    console.error('POST /api/shifts error:', err)
    return error('CREATE_FAILED', 500)
  }
}
