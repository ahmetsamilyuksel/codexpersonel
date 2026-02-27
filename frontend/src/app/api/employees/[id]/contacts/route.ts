import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success, error } from '@/lib/api-response'
import { createAuditLog } from '@/lib/audit'

interface RouteParams {
  params: Promise<{ id: string }>
}

// ==================== GET /api/employees/[id]/contacts ====================
// List all contacts for an employee

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

    const contacts = await prisma.employeeContact.findMany({
      where: { employeeId: id },
      orderBy: { createdAt: 'asc' },
    })

    return success(contacts)
  } catch (err: any) {
    console.error('GET /api/employees/[id]/contacts error:', err)
    return error('FETCH_FAILED', 500)
  }
}

// ==================== POST /api/employees/[id]/contacts ====================
// Add a new contact for an employee

export async function POST(request: NextRequest, { params }: RouteParams) {
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

    // Validate required fields
    if (!body.contactType) {
      return error('FIELDS_REQUIRED', 400)
    }
    if (!body.fullName) {
      return error('FIELDS_REQUIRED', 400)
    }

    const contact = await prisma.employeeContact.create({
      data: {
        employeeId: id,
        contactType: body.contactType,
        fullName: body.fullName,
        relationship: body.relationship || null,
        phone: body.phone || null,
        email: body.email || null,
        address: body.address || null,
        notes: body.notes || null,
      },
    })

    // Audit log
    await createAuditLog({
      action: 'CREATE',
      entity: 'EmployeeContact',
      entityId: contact.id,
      newValues: contact,
    })

    return success(contact, 201)
  } catch (err: any) {
    console.error('POST /api/employees/[id]/contacts error:', err)
    return error('CREATE_FAILED', 500)
  }
}
