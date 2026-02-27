import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success, error, paginated } from '@/lib/api-response'
import { createAuditLog } from '@/lib/audit'
import { getCurrentUser } from '@/lib/auth'

// ==================== GET /api/transfers ====================
// List transfers with employee and worksite info

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const employeeId = searchParams.get('employeeId') || ''
    const status = searchParams.get('status') || ''
    const fromWorksiteId = searchParams.get('fromWorksiteId') || ''
    const toWorksiteId = searchParams.get('toWorksiteId') || ''
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (employeeId) where.employeeId = employeeId
    if (status) where.status = status
    if (fromWorksiteId) where.fromWorksiteId = fromWorksiteId
    if (toWorksiteId) where.toWorksiteId = toWorksiteId

    const [data, total] = await Promise.all([
      prisma.employeeSiteTransfer.findMany({
        where: where as any,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          employee: {
            select: {
              id: true,
              employeeNo: true,
              firstName: true,
              lastName: true,
            },
          },
          fromWorksite: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          toWorksite: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      }),
      prisma.employeeSiteTransfer.count({ where: where as any }),
    ])

    return paginated(data, total, page, limit)
  } catch (err) {
    console.error('GET /api/transfers error:', err)
    return error('FETCH_FAILED', 500)
  }
}

// ==================== POST /api/transfers ====================
// Create transfer, optionally update employee's worksite

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) return error('UNAUTHORIZED', 401)

    const body = await request.json()
    const { employeeId, fromWorksiteId, toWorksiteId, transferDate, transferType } = body

    if (!employeeId || !fromWorksiteId || !toWorksiteId || !transferDate || !transferType) {
      return error('FIELDS_REQUIRED', 400)
    }

    // Verify employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId, deletedAt: null },
      include: { employment: true },
    })
    if (!employee) {
      return error('EMPLOYEE_NOT_FOUND', 404)
    }

    // Verify worksites exist
    const [fromSite, toSite] = await Promise.all([
      prisma.worksite.findUnique({ where: { id: fromWorksiteId } }),
      prisma.worksite.findUnique({ where: { id: toWorksiteId } }),
    ])

    if (!fromSite) return error('WORKSITE_NOT_FOUND', 404)
    if (!toSite) return error('WORKSITE_NOT_FOUND', 404)

    const transfer = await prisma.$transaction(async (tx: any) => {
      const created = await tx.employeeSiteTransfer.create({
        data: {
          employeeId,
          fromWorksiteId,
          toWorksiteId,
          transferDate: new Date(transferDate),
          transferType,
          reason: body.reason || null,
          accommodationEffect: body.accommodationEffect || null,
          salaryEffect: body.salaryEffect || null,
          status: body.status || 'PENDING',
          notes: body.notes || null,
          createdById: user.id,
        },
        include: {
          employee: {
            select: {
              id: true,
              employeeNo: true,
              firstName: true,
              lastName: true,
            },
          },
          fromWorksite: {
            select: { id: true, code: true, name: true },
          },
          toWorksite: {
            select: { id: true, code: true, name: true },
          },
        },
      })

      // If auto-complete transfer (immediate), update employee's worksite
      if (body.autoComplete === true) {
        await tx.employeeEmployment.updateMany({
          where: { employeeId },
          data: { worksiteId: toWorksiteId },
        })

        await tx.employeeSiteTransfer.update({
          where: { id: created.id },
          data: {
            status: 'COMPLETED',
            approvedById: user.id,
            approvedAt: new Date(),
          },
        })
      }

      return created
    })

    await createAuditLog({
      userId: user.id,
      action: 'CREATE',
      entity: 'EmployeeSiteTransfer',
      entityId: transfer.id,
      newValues: body,
    })

    return success(transfer, 201)
  } catch (err) {
    console.error('POST /api/transfers error:', err)
    return error('CREATE_FAILED', 500)
  }
}
