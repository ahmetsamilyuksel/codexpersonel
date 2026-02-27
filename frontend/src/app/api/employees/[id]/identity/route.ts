import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success, error } from '@/lib/api-response'
import { createAuditLog } from '@/lib/audit'

interface RouteParams {
  params: Promise<{ id: string }>
}

// ==================== GET /api/employees/[id]/identity ====================
// Get employee identity record

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

    const identity = await prisma.employeeIdentity.findUnique({
      where: { employeeId: id },
    })

    if (!identity) {
      return error('NOT_FOUND', 404)
    }

    return success(identity)
  } catch (err: any) {
    console.error('GET /api/employees/[id]/identity error:', err)
    return error('FETCH_FAILED', 500)
  }
}

// ==================== PUT /api/employees/[id]/identity ====================
// Upsert employee identity (create if not exists, update if exists)

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
    const existing = await prisma.employeeIdentity.findUnique({
      where: { employeeId: id },
    })

    const identity = await prisma.employeeIdentity.upsert({
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
      entity: 'EmployeeIdentity',
      entityId: identity.id,
      oldValues: existing || undefined,
      newValues: body,
    })

    return success(identity)
  } catch (err: any) {
    console.error('PUT /api/employees/[id]/identity error:', err)
    return error('UPDATE_FAILED', 500)
  }
}
