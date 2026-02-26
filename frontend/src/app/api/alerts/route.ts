import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success, error, paginated } from '@/lib/api-response'
import { createAuditLog } from '@/lib/audit'
import { getCurrentUser } from '@/lib/auth'

// ==================== GET /api/alerts ====================
// List alerts with filters (severity, isRead, employeeId)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const severity = searchParams.get('severity') || ''
    const isRead = searchParams.get('isRead')
    const employeeId = searchParams.get('employeeId') || ''
    const isDismissed = searchParams.get('isDismissed')
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (severity) where.severity = severity
    if (isRead !== null && isRead !== '') where.isRead = isRead === 'true'
    if (isDismissed !== null && isDismissed !== '') where.isDismissed = isDismissed === 'true'
    if (employeeId) where.employeeId = employeeId

    const [data, total] = await Promise.all([
      prisma.alert.findMany({
        where: where as any,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          alertRule: {
            select: {
              id: true,
              code: true,
              nameTr: true,
              nameRu: true,
              nameEn: true,
            },
          },
          employee: {
            select: {
              id: true,
              employeeNo: true,
              firstName: true,
              lastName: true,
              photoUrl: true,
            },
          },
        },
      }),
      prisma.alert.count({ where: where as any }),
    ])

    return paginated(data, total, page, limit)
  } catch (err) {
    console.error('GET /api/alerts error:', err)
    return error('Failed to fetch alerts', 500)
  }
}

// ==================== POST /api/alerts ====================
// Generate alerts: scan all employees for expiring items based on alert rules
// For each active alert rule, check the corresponding date field on employees
// Create alerts for items within warning/critical days
// Skip already-existing unresolved alerts

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) return error('Unauthorized', 401)

    const now = new Date()
    let createdCount = 0
    let skippedCount = 0

    // Get all active alert rules
    const rules = await prisma.alertRule.findMany({
      where: { isActive: true },
    })

    for (const rule of rules) {
      // Determine which Prisma model/relation to query based on entity + dateField
      const employees = await getEmployeesWithExpiringDates(rule.entity, rule.dateField, rule.warningDays, now)

      for (const emp of employees) {
        const expiryDate = emp.expiryDate
        if (!expiryDate) continue

        const daysUntilExpiry = Math.ceil(
          (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        )

        // Determine severity
        let severity: string | null = null
        if (daysUntilExpiry <= rule.criticalDays) {
          severity = 'CRITICAL'
        } else if (daysUntilExpiry <= rule.warningDays) {
          severity = 'WARNING'
        }

        if (!severity) continue

        // Check if unresolved alert already exists for this rule + employee
        const existingAlert = await prisma.alert.findFirst({
          where: {
            alertRuleId: rule.id,
            employeeId: emp.employeeId,
            resolvedAt: null,
            isDismissed: false,
          },
        })

        if (existingAlert) {
          // Update severity if it changed (e.g. WARNING -> CRITICAL)
          if (existingAlert.severity !== severity) {
            await prisma.alert.update({
              where: { id: existingAlert.id },
              data: {
                severity,
                message: buildAlertMessage(rule, emp.employeeName, daysUntilExpiry, expiryDate),
              },
            })
          }
          skippedCount++
          continue
        }

        // Create new alert
        await prisma.alert.create({
          data: {
            alertRuleId: rule.id,
            employeeId: emp.employeeId,
            severity,
            title: `${rule.nameTr} - ${emp.employeeName}`,
            message: buildAlertMessage(rule, emp.employeeName, daysUntilExpiry, expiryDate),
            expiryDate,
          },
        })

        createdCount++
      }
    }

    await createAuditLog({
      userId: user.id,
      action: 'GENERATE',
      entity: 'Alert',
      newValues: { createdCount, skippedCount, rulesProcessed: rules.length },
    })

    return success({
      message: 'Alert generation completed',
      createdCount,
      skippedCount,
      rulesProcessed: rules.length,
    }, 201)
  } catch (err) {
    console.error('POST /api/alerts error:', err)
    return error('Failed to generate alerts', 500)
  }
}

// ==================== Helper Functions ====================

interface EmployeeExpiry {
  employeeId: string
  employeeName: string
  expiryDate: Date | null
}

function buildAlertMessage(
  rule: { nameTr: string; dateField: string },
  employeeName: string,
  daysUntilExpiry: number,
  expiryDate: Date
): string {
  if (daysUntilExpiry <= 0) {
    return `${rule.nameTr}: ${employeeName} - expired on ${expiryDate.toISOString().split('T')[0]}`
  }
  return `${rule.nameTr}: ${employeeName} - expires in ${daysUntilExpiry} days (${expiryDate.toISOString().split('T')[0]})`
}

async function getEmployeesWithExpiringDates(
  entity: string,
  dateField: string,
  warningDays: number,
  now: Date
): Promise<EmployeeExpiry[]> {
  const warningDate = new Date(now.getTime() + warningDays * 24 * 60 * 60 * 1000)
  const results: EmployeeExpiry[] = []

  if (entity === 'EmployeeWorkStatus' || entity === 'employee_work_statuses') {
    const records = await prisma.employeeWorkStatus.findMany({
      where: {
        [dateField]: { lte: warningDate, not: null },
        employee: { status: 'ACTIVE', deletedAt: null },
      },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    })

    for (const record of records) {
      const dateValue = (record as any)[dateField]
      if (dateValue) {
        results.push({
          employeeId: record.employee.id,
          employeeName: `${record.employee.firstName} ${record.employee.lastName}`,
          expiryDate: new Date(dateValue),
        })
      }
    }
  } else if (entity === 'EmployeeIdentity' || entity === 'employee_identities') {
    const records = await prisma.employeeIdentity.findMany({
      where: {
        [dateField]: { lte: warningDate, not: null },
        employee: { status: 'ACTIVE', deletedAt: null },
      },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    })

    for (const record of records) {
      const dateValue = (record as any)[dateField]
      if (dateValue) {
        results.push({
          employeeId: record.employee.id,
          employeeName: `${record.employee.firstName} ${record.employee.lastName}`,
          expiryDate: new Date(dateValue),
        })
      }
    }
  } else if (entity === 'EmployeeDocument' || entity === 'employee_documents') {
    const records = await prisma.employeeDocument.findMany({
      where: {
        [dateField]: { lte: warningDate, not: null },
        deletedAt: null,
        employee: { status: 'ACTIVE', deletedAt: null },
      },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    })

    for (const record of records) {
      const dateValue = (record as any)[dateField]
      if (dateValue) {
        results.push({
          employeeId: record.employee.id,
          employeeName: `${record.employee.firstName} ${record.employee.lastName}`,
          expiryDate: new Date(dateValue),
        })
      }
    }
  } else if (entity === 'EmployeeEmployment' || entity === 'employee_employments') {
    const records = await prisma.employeeEmployment.findMany({
      where: {
        [dateField]: { lte: warningDate, not: null },
        employee: { status: 'ACTIVE', deletedAt: null },
      },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    })

    for (const record of records) {
      const dateValue = (record as any)[dateField]
      if (dateValue) {
        results.push({
          employeeId: record.employee.id,
          employeeName: `${record.employee.firstName} ${record.employee.lastName}`,
          expiryDate: new Date(dateValue),
        })
      }
    }
  }

  return results
}
