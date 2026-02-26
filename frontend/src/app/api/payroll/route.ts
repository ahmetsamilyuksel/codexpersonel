import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success, error, paginated } from '@/lib/api-response'
import { createAuditLog } from '@/lib/audit'
import { getCurrentUser } from '@/lib/auth'

// ==================== GET /api/payroll ====================
// List payroll runs with items

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
      prisma.payrollRun.findMany({
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
      prisma.payrollRun.count({ where: where as any }),
    ])

    return paginated(data, total, page, limit)
  } catch (err) {
    console.error('GET /api/payroll error:', err)
    return error('Failed to fetch payroll runs', 500)
  }
}

// ==================== POST /api/payroll ====================
// Create payroll run for period+worksite

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) return error('Unauthorized', 401)

    const body = await request.json()
    const { period, worksiteId } = body

    if (!period) {
      return error('Period is required (e.g. 2025-01)', 400)
    }

    // Check for duplicate
    const existing = await prisma.payrollRun.findUnique({
      where: {
        period_worksiteId: {
          period,
          worksiteId: worksiteId || null,
        },
      },
    })

    if (existing) {
      return error('A payroll run already exists for this period and worksite', 409)
    }

    const payrollRun = await prisma.payrollRun.create({
      data: {
        period,
        worksiteId: worksiteId || null,
        status: 'DRAFT',
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
      entity: 'PayrollRun',
      entityId: payrollRun.id,
      newValues: body,
    })

    return success(payrollRun, 201)
  } catch (err) {
    console.error('POST /api/payroll error:', err)
    return error('Failed to create payroll run', 500)
  }
}
