import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success, error, paginated } from '@/lib/api-response'
import { createAuditLog } from '@/lib/audit'
import { getCurrentUser } from '@/lib/auth'
import { generateNumber } from '@/lib/numbering'

// ==================== GET /api/assets ====================
// List assets with filters (status, categoryId, worksiteId)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const categoryId = searchParams.get('categoryId') || ''
    const worksiteId = searchParams.get('worksiteId') || ''
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = { deletedAt: null }
    if (status) where.status = status
    if (categoryId) where.categoryId = categoryId
    if (worksiteId) where.worksiteId = worksiteId

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { assetNo: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
        { serialNo: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [data, total] = await Promise.all([
      prisma.asset.findMany({
        where: where as any,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          category: {
            select: {
              id: true,
              code: true,
              nameTr: true,
              nameRu: true,
              nameEn: true,
            },
          },
          worksite: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          assignments: {
            where: { returnDate: null },
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
            take: 1,
          },
        },
      }),
      prisma.asset.count({ where: where as any }),
    ])

    return paginated(data, total, page, limit)
  } catch (err) {
    console.error('GET /api/assets error:', err)
    return error('FETCH_FAILED', 500)
  }
}

// ==================== POST /api/assets ====================
// Create asset with auto-generated assetNo

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) return error('UNAUTHORIZED', 401)

    const body = await request.json()
    const { categoryId, name } = body

    if (!categoryId || !name) {
      return error('FIELDS_REQUIRED', 400)
    }

    // Auto-generate asset number
    const assetNo = await generateNumber('ASSET')

    const asset = await prisma.asset.create({
      data: {
        assetNo,
        categoryId,
        name,
        brand: body.brand || null,
        model: body.model || null,
        serialNo: body.serialNo || null,
        worksiteId: body.worksiteId || null,
        status: body.status || 'AVAILABLE',
        purchaseDate: body.purchaseDate ? new Date(body.purchaseDate) : null,
        purchasePrice: body.purchasePrice ?? null,
        depositAmount: body.depositAmount ?? null,
        photoUrl: body.photoUrl || null,
        notes: body.notes || null,
      },
      include: {
        category: {
          select: {
            id: true,
            code: true,
            nameTr: true,
            nameRu: true,
            nameEn: true,
          },
        },
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
      entity: 'Asset',
      entityId: asset.id,
      newValues: body,
    })

    return success(asset, 201)
  } catch (err) {
    console.error('POST /api/assets error:', err)
    return error('CREATE_FAILED', 500)
  }
}
