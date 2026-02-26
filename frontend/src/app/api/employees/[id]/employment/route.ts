import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success, error } from '@/lib/api-response'
import { createAuditLog } from '@/lib/audit'

interface RouteParams {
  params: Promise<{ id: string }>
}

// ==================== GET /api/employees/[id]/employment ====================
// Get employee employment record with worksite and shift details

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    // Verify employee exists
    const employee = await prisma.employee.findUnique({
      where: { id, deletedAt: null },
      select: { id: true },
    })

    if (!employee) {
      return error('Employee not found', 404)
    }

    const employment = await prisma.employeeEmployment.findUnique({
      where: { employeeId: id },
      include: {
        worksite: {
          select: {
            id: true,
            code: true,
            name: true,
            city: true,
            region: true,
            status: true,
          },
        },
        shift: {
          select: {
            id: true,
            code: true,
            nameTr: true,
            nameRu: true,
            nameEn: true,
            startTime: true,
            endTime: true,
            breakMinutes: true,
            isNightShift: true,
          },
        },
      },
    })

    if (!employment) {
      return error('Employment record not found', 404)
    }

    return success(employment)
  } catch (err: any) {
    console.error('GET /api/employees/[id]/employment error:', err)
    return error(err.message || 'Failed to fetch employment', 500)
  }
}

// ==================== PUT /api/employees/[id]/employment ====================
// Upsert employee employment (create if not exists, update if exists)

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const body = await request.json()

    // Verify employee exists
    const employee = await prisma.employee.findUnique({
      where: { id, deletedAt: null },
      select: { id: true },
    })

    if (!employee) {
      return error('Employee not found', 404)
    }

    // Fetch existing for audit trail
    const existing = await prisma.employeeEmployment.findUnique({
      where: { employeeId: id },
    })

    const employment = await prisma.employeeEmployment.upsert({
      where: { employeeId: id },
      create: {
        ...body,
        employeeId: id,
      },
      update: body,
    })

    // Re-fetch with relations for the response
    const result = await prisma.employeeEmployment.findUnique({
      where: { employeeId: id },
      include: {
        worksite: {
          select: {
            id: true,
            code: true,
            name: true,
            city: true,
            region: true,
            status: true,
          },
        },
        shift: {
          select: {
            id: true,
            code: true,
            nameTr: true,
            nameRu: true,
            nameEn: true,
            startTime: true,
            endTime: true,
            breakMinutes: true,
            isNightShift: true,
          },
        },
      },
    })

    // Audit log
    await createAuditLog({
      action: existing ? 'UPDATE' : 'CREATE',
      entity: 'EmployeeEmployment',
      entityId: employment.id,
      oldValues: existing || undefined,
      newValues: body,
    })

    return success(result)
  } catch (err: any) {
    console.error('PUT /api/employees/[id]/employment error:', err)
    return error(err.message || 'Failed to upsert employment', 500)
  }
}
