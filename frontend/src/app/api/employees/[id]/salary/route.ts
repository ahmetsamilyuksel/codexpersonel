import { NextRequest } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { success, error } from '@/lib/api-response'
import { createAuditLog } from '@/lib/audit'

type TransactionClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

interface RouteParams {
  params: Promise<{ id: string }>
}

// ==================== Tax Calculation Helpers ====================

/**
 * Russian tax rates by status:
 * - RESIDENT: 13% NDFL (standard), 15% on income above threshold
 * - NON_RESIDENT: 30% NDFL
 * - PATENT: 13% NDFL (patent holders treated as resident rate)
 * - HQS (Highly Qualified Specialist): 13% NDFL
 */
function getNdflRate(taxStatus: string, customNdflRate?: number | null): number {
  if (customNdflRate !== undefined && customNdflRate !== null) {
    return Number(customNdflRate)
  }

  switch (taxStatus) {
    case 'RESIDENT':
    case 'PATENT':
    case 'HQS':
      return 13
    case 'NON_RESIDENT':
      return 30
    default:
      return 13
  }
}

/**
 * Calculate gross salary from net salary.
 * Formula: gross = net / (1 - ndflRate/100)
 *
 * For Russian payroll: NDFL is withheld from gross salary.
 * Net = Gross - (Gross * NDFL_Rate / 100)
 * Therefore: Gross = Net / (1 - NDFL_Rate / 100)
 */
function calculateGrossFromNet(netSalary: number, ndflRate: number): number {
  const rate = ndflRate / 100
  const gross = netSalary / (1 - rate)
  return Math.round(gross * 100) / 100
}

/**
 * Calculate net salary from gross salary.
 * Formula: net = gross - (gross * ndflRate/100)
 */
function calculateNetFromGross(grossSalary: number, ndflRate: number): number {
  const tax = grossSalary * (ndflRate / 100)
  const net = grossSalary - tax
  return Math.round(net * 100) / 100
}

// ==================== GET /api/employees/[id]/salary ====================
// Get employee salary profile

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

    const salaryProfile = await prisma.employeeSalaryProfile.findUnique({
      where: { employeeId: id },
    })

    if (!salaryProfile) {
      return error('Salary profile not found', 404)
    }

    // Also fetch recent salary revisions
    const revisions = await prisma.salaryRevision.findMany({
      where: { employeeId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    return success({
      ...salaryProfile,
      revisions,
    })
  } catch (err: any) {
    console.error('GET /api/employees/[id]/salary error:', err)
    return error(err.message || 'Failed to fetch salary profile', 500)
  }
}

// ==================== PUT /api/employees/[id]/salary ====================
// Upsert salary profile with gross/net calculations and salary revision tracking.
//
// When the client sends netSalary, grossSalary is auto-calculated based on tax rules.
// When the client sends grossSalary, netSalary is auto-calculated.
// The client can also send both explicitly.
//
// Tax status determines the NDFL rate used for calculations unless a custom ndflRate is provided.

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

    // Fetch existing salary profile for change tracking
    const existing = await prisma.employeeSalaryProfile.findUnique({
      where: { employeeId: id },
    })

    // Determine tax rate
    const taxStatus = body.taxStatus || existing?.taxStatus || 'RESIDENT'
    const ndflRate = getNdflRate(taxStatus, body.ndflRate ?? existing?.ndflRate)

    // Auto-calculate gross/net salary
    let netSalary = body.netSalary !== undefined ? Number(body.netSalary) : null
    let grossSalary = body.grossSalary !== undefined ? Number(body.grossSalary) : null

    if (netSalary !== null && grossSalary === null) {
      // Calculate gross from net
      grossSalary = calculateGrossFromNet(netSalary, ndflRate)
    } else if (grossSalary !== null && netSalary === null) {
      // Calculate net from gross
      netSalary = calculateNetFromGross(grossSalary, ndflRate)
    }
    // If both are provided, use them as-is (client-specified override)

    // Build the data payload with calculated values
    const salaryData = {
      ...body,
      ndflRate,
      ...(netSalary !== null ? { netSalary } : {}),
      ...(grossSalary !== null ? { grossSalary } : {}),
    }

    // Perform the upsert inside a transaction to also create salary revisions
    const result = await prisma.$transaction(async (tx: TransactionClient) => {
      const salaryProfile = await tx.employeeSalaryProfile.upsert({
        where: { employeeId: id },
        create: {
          ...salaryData,
          employeeId: id,
        },
        update: salaryData,
      })

      // Track salary revisions for key financial fields
      if (existing) {
        const trackedFields = [
          'paymentType',
          'netSalary',
          'grossSalary',
          'hourlyRate',
          'dailyRate',
          'overtimeMultiplier',
          'nightMultiplier',
          'holidayMultiplier',
          'advanceLimit',
          'paymentMethod',
          'taxStatus',
          'ndflRate',
        ]

        const effectiveFrom = body.effectiveFrom
          ? new Date(body.effectiveFrom)
          : new Date()

        for (const field of trackedFields) {
          const oldVal = existing[field as keyof typeof existing]
          const newVal = salaryProfile[field as keyof typeof salaryProfile]

          // Compare as strings for Decimal fields
          const oldStr = oldVal !== null && oldVal !== undefined ? String(oldVal) : null
          const newStr = newVal !== null && newVal !== undefined ? String(newVal) : null

          if (oldStr !== newStr) {
            await tx.salaryRevision.create({
              data: {
                employeeId: id,
                field,
                oldValue: oldStr,
                newValue: newStr,
                effectiveFrom,
                reason: body.revisionReason || null,
              },
            })
          }
        }
      }

      return salaryProfile
    })

    // Audit log
    await createAuditLog({
      action: existing ? 'UPDATE' : 'CREATE',
      entity: 'EmployeeSalaryProfile',
      entityId: result.id,
      oldValues: existing || undefined,
      newValues: salaryData,
    })

    // Fetch revisions for the response
    const revisions = await prisma.salaryRevision.findMany({
      where: { employeeId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    return success({
      ...result,
      revisions,
    })
  } catch (err: any) {
    console.error('PUT /api/employees/[id]/salary error:', err)
    return error(err.message || 'Failed to upsert salary profile', 500)
  }
}
