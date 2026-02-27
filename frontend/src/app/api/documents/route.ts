import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success, error, paginated } from '@/lib/api-response'

// ==================== GET /api/documents ====================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const search = searchParams.get('search') || ''
    const category = searchParams.get('category') || ''
    const sort = searchParams.get('sort') || 'createdAt'
    const order = (searchParams.get('order') || 'desc') as 'asc' | 'desc'
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}

    if (search) {
      where.OR = [
        { documentNo: { contains: search, mode: 'insensitive' } },
        { employee: { firstName: { contains: search, mode: 'insensitive' } } },
        { employee: { lastName: { contains: search, mode: 'insensitive' } } },
        { employee: { employeeNo: { contains: search, mode: 'insensitive' } } },
      ]
    }

    if (category) {
      where.documentType = { category }
    }

    const [data, total] = await Promise.all([
      prisma.employeeDocument.findMany({
        where: where as any,
        skip,
        take: limit,
        orderBy: { [sort]: order },
        include: {
          employee: {
            select: {
              id: true,
              employeeNo: true,
              firstName: true,
              lastName: true,
            },
          },
          documentType: {
            select: {
              id: true,
              code: true,
              nameTr: true,
              nameRu: true,
              nameEn: true,
              category: true,
              hasExpiry: true,
            },
          },
        },
      }),
      prisma.employeeDocument.count({ where: where as any }),
    ])

    return paginated(data, total, page, limit)
  } catch (err: any) {
    console.error('GET /api/documents error:', err)
    return error('FETCH_FAILED', 500)
  }
}
