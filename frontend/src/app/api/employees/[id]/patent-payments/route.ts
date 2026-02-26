import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success, error } from '@/lib/api-response'
import { createAuditLog } from '@/lib/audit'

interface RouteParams {
  params: Promise<{ id: string }>
}

// ==================== GET /api/employees/[id]/patent-payments ====================
// List patent payments for an employee, ordered by year/month descending

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

    // Optional year filter from query params
    const { searchParams } = new URL(request.url)
    const yearParam = searchParams.get('year')

    const where: any = { employeeId: id }
    if (yearParam) {
      where.year = parseInt(yearParam, 10)
    }

    const payments = await prisma.patentPayment.findMany({
      where,
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    })

    return success(payments)
  } catch (err: any) {
    console.error('GET /api/employees/[id]/patent-payments error:', err)
    return error(err.message || 'Failed to fetch patent payments', 500)
  }
}

// ==================== POST /api/employees/[id]/patent-payments ====================
// Create or update a patent payment for an employee.
// Uses upsert on the unique constraint (employeeId, year, month)
// so the client can send payment data for a specific month and it will
// either create a new record or update the existing one.

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
      return error('Employee not found', 404)
    }

    // Validate required fields
    if (body.year === undefined || body.year === null) {
      return error('year is required', 400)
    }
    if (body.month === undefined || body.month === null) {
      return error('month is required', 400)
    }
    if (body.amount === undefined || body.amount === null) {
      return error('amount is required', 400)
    }

    const year = parseInt(String(body.year), 10)
    const month = parseInt(String(body.month), 10)

    if (month < 1 || month > 12) {
      return error('month must be between 1 and 12', 400)
    }

    // Check if existing record exists for audit
    const existing = await prisma.patentPayment.findUnique({
      where: {
        employeeId_year_month: {
          employeeId: id,
          year,
          month,
        },
      },
    })

    const paymentData = {
      amount: body.amount,
      paidDate: body.paidDate ? new Date(body.paidDate) : null,
      receiptUrl: body.receiptUrl || null,
      notes: body.notes || null,
    }

    const payment = await prisma.patentPayment.upsert({
      where: {
        employeeId_year_month: {
          employeeId: id,
          year,
          month,
        },
      },
      create: {
        employeeId: id,
        year,
        month,
        ...paymentData,
      },
      update: paymentData,
    })

    // Audit log
    await createAuditLog({
      action: existing ? 'UPDATE' : 'CREATE',
      entity: 'PatentPayment',
      entityId: payment.id,
      oldValues: existing || undefined,
      newValues: { year, month, ...paymentData },
    })

    return success(payment, existing ? 200 : 201)
  } catch (err: any) {
    console.error('POST /api/employees/[id]/patent-payments error:', err)
    return error(err.message || 'Failed to upsert patent payment', 500)
  }
}
