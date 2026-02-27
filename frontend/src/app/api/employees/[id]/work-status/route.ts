import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success, error } from '@/lib/api-response'
import { createAuditLog } from '@/lib/audit'

interface RouteParams {
  params: Promise<{ id: string }>
}

// ==================== GET /api/employees/[id]/work-status ====================
// Get employee work status record

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    // Verify employee exists
    const employee = await prisma.employee.findUnique({
      where: { id, deletedAt: null },
      select: { id: true },
    })

    if (!employee) {
      return error('NOT_FOUND', 404)
    }

    const workStatus = await prisma.employeeWorkStatus.findUnique({
      where: { employeeId: id },
    })

    if (!workStatus) {
      return error('NOT_FOUND', 404)
    }

    return success(workStatus)
  } catch (err: any) {
    console.error('GET /api/employees/[id]/work-status error:', err)
    return error('FETCH_FAILED', 500)
  }
}

// ==================== PUT /api/employees/[id]/work-status ====================
// Upsert employee work status (create if not exists, update if exists)

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
      return error('NOT_FOUND', 404)
    }

    // Fetch existing for audit trail
    const existing = await prisma.employeeWorkStatus.findUnique({
      where: { employeeId: id },
    })

    const workStatus = await prisma.employeeWorkStatus.upsert({
      where: { employeeId: id },
      create: {
        ...body,
        employeeId: id,
      },
      update: body,
    })

    // Audit log
    await createAuditLog({
      action: existing ? 'UPDATE' : 'CREATE',
      entity: 'EmployeeWorkStatus',
      entityId: workStatus.id,
      oldValues: existing || undefined,
      newValues: body,
    })

    return success(workStatus)
  } catch (err: any) {
    console.error('PUT /api/employees/[id]/work-status error:', err)
    return error('UPDATE_FAILED', 500)
  }
}
