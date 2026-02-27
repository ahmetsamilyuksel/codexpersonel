import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success, error, paginated } from '@/lib/api-response'
import { createAuditLog } from '@/lib/audit'
import { generateNumber } from '@/lib/numbering'
import { parseQueryParams, buildWhereClause, buildOrderBy } from '@/lib/query-helpers'

// ==================== GET /api/employees ====================
// List employees with pagination, search, filters, sorting, and includes

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const { page, limit, skip, sort, order, search, filters } = parseQueryParams(searchParams)

    // Build search conditions across multiple employee fields
    const searchFields = ['firstName', 'lastName', 'employeeNo', 'phone']

    // Extract known filter keys and map nested ones
    const mappedFilters: Record<string, string> = {}
    for (const [key, value] of Object.entries(filters)) {
      if (key === 'worksiteId') {
        // Filter through employment relation
        mappedFilters['employment.worksiteId'] = value
      } else {
        mappedFilters[key] = value
      }
    }

    const whereClause = buildWhereClause(search, searchFields, mappedFilters)

    // Always exclude soft-deleted employees
    const deletedAtCondition = { deletedAt: null }
    let where: Record<string, any>

    if (whereClause.AND) {
      where = {
        AND: [...whereClause.AND, deletedAtCondition],
      }
    } else if (Object.keys(whereClause).length > 0) {
      where = {
        AND: [whereClause, deletedAtCondition],
      }
    } else {
      where = deletedAtCondition
    }

    const orderBy = buildOrderBy(sort, order)

    const [employees, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          nationality: {
            select: {
              id: true,
              code: true,
              nameTr: true,
              nameRu: true,
              nameEn: true,
            },
          },
          profession: {
            select: {
              id: true,
              code: true,
              nameTr: true,
              nameRu: true,
              nameEn: true,
            },
          },
          department: {
            select: {
              id: true,
              code: true,
              nameTr: true,
              nameRu: true,
              nameEn: true,
            },
          },
          employment: {
            select: {
              id: true,
              worksiteId: true,
              shiftId: true,
              workType: true,
              contractType: true,
              hireDate: true,
              terminationDate: true,
              teamName: true,
              worksite: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  city: true,
                  status: true,
                },
              },
            },
          },
        },
      }),
      prisma.employee.count({ where }),
    ])

    return paginated(employees, total, page, limit)
  } catch (err: any) {
    console.error('GET /api/employees error:', err)
    return error('FETCH_FAILED', 500)
  }
}

// ==================== POST /api/employees ====================
// Create a new employee with auto-generated employeeNo
// Optionally creates related records: identity, workStatus, employment, salaryProfile

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      identity,
      workStatus,
      employment,
      salaryProfile,
      ...employeeData
    } = body

    // Auto-generate employee number
    const employeeNo = await generateNumber('EMPLOYEE')

    // Build nested creates for related records
    const createData: any = {
      ...employeeData,
      employeeNo,
      identity: identity
        ? { create: identity }
        : undefined,
      workStatus: workStatus
        ? { create: workStatus }
        : undefined,
      employment: employment
        ? { create: employment }
        : undefined,
      salaryProfile: salaryProfile
        ? { create: salaryProfile }
        : undefined,
    }

    // Remove undefined keys so Prisma doesn't complain
    for (const key of Object.keys(createData)) {
      if (createData[key] === undefined) {
        delete createData[key]
      }
    }

    const employee = await prisma.employee.create({
      data: createData,
      include: {
        nationality: true,
        profession: true,
        department: true,
        identity: true,
        workStatus: true,
        employment: {
          include: { worksite: true },
        },
        salaryProfile: true,
      },
    })

    // Create audit log
    await createAuditLog({
      action: 'CREATE',
      entity: 'Employee',
      entityId: employee.id,
      newValues: employee,
    })

    return success(employee, 201)
  } catch (err: any) {
    console.error('POST /api/employees error:', err)

    if (err.code === 'P2002') {
      return error('ALREADY_EXISTS', 409)
    }

    return error('CREATE_FAILED', 500)
  }
}
