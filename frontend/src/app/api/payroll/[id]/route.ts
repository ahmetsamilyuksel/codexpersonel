import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success, error } from '@/lib/api-response'
import { createAuditLog } from '@/lib/audit'
import { getCurrentUser } from '@/lib/auth'
import { grossToNet, netToGross, PayrollRuleVersionData, TaxStatus } from '@/lib/payroll-engine'

interface RouteParams {
  params: Promise<{ id: string }>
}

// ==================== GET /api/payroll/[id] ====================
// Get payroll run with all items, earnings, deductions

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    const payrollRun = await prisma.payrollRun.findUnique({
      where: { id },
      include: {
        worksite: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        items: {
          include: {
            employee: {
              select: {
                id: true,
                employeeNo: true,
                firstName: true,
                lastName: true,
              },
            },
            earnings: {
              orderBy: { createdAt: 'asc' },
            },
            deductions: {
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { employee: { lastName: 'asc' } },
        },
      },
    })

    if (!payrollRun) {
      return error('Payroll run not found', 404)
    }

    return success(payrollRun)
  } catch (err) {
    console.error('GET /api/payroll/[id] error:', err)
    return error('Failed to fetch payroll run', 500)
  }
}

// ==================== PUT /api/payroll/[id] ====================
// Update status, approve

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser(request)
    if (!user) return error('Unauthorized', 401)

    const { id } = await params
    const body = await request.json()

    const existing = await prisma.payrollRun.findUnique({
      where: { id },
    })

    if (!existing) {
      return error('Payroll run not found', 404)
    }

    const updateData: Record<string, unknown> = {}

    if (body.status) {
      // Validate status transitions
      const validTransitions: Record<string, string[]> = {
        DRAFT: ['CALCULATED', 'CANCELLED'],
        CALCULATED: ['APPROVED', 'DRAFT'],
        APPROVED: ['PAID', 'CALCULATED'],
        PAID: [],
        CANCELLED: [],
      }

      const allowed = validTransitions[existing.status] || []
      if (!allowed.includes(body.status)) {
        return error(`Cannot transition from ${existing.status} to ${body.status}`, 400)
      }

      updateData.status = body.status

      if (body.status === 'APPROVED') {
        updateData.approvedById = user.id
        updateData.approvedAt = new Date()
      }
    }

    if (body.notes !== undefined) {
      updateData.notes = body.notes
    }

    const payrollRun = await prisma.payrollRun.update({
      where: { id },
      data: updateData,
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
    })

    await createAuditLog({
      userId: user.id,
      action: 'UPDATE',
      entity: 'PayrollRun',
      entityId: id,
      oldValues: { status: existing.status },
      newValues: updateData,
    })

    return success(payrollRun)
  } catch (err) {
    console.error('PUT /api/payroll/[id] error:', err)
    return error('Failed to update payroll run', 500)
  }
}

// ==================== POST /api/payroll/[id] ====================
// With action=calculate: Calculate payroll for all employees

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser(request)
    if (!user) return error('Unauthorized', 401)

    const { id } = await params
    const body = await request.json()

    if (body.action !== 'calculate') {
      return error('Invalid action. Supported: calculate', 400)
    }

    const payrollRun = await prisma.payrollRun.findUnique({
      where: { id },
      include: {
        worksite: true,
      },
    })

    if (!payrollRun) {
      return error('Payroll run not found', 404)
    }

    if (payrollRun.status !== 'DRAFT' && payrollRun.status !== 'CALCULATED') {
      return error('Payroll can only be calculated in DRAFT or CALCULATED status', 400)
    }

    // Get active payroll rule versions for the period
    const periodDate = new Date(`${payrollRun.period}-01`)
    const ruleVersions = await prisma.payrollRuleVersion.findMany({
      where: {
        effectiveFrom: { lte: periodDate },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: periodDate } },
        ],
        payrollRule: { isActive: true },
      },
      include: {
        payrollRule: {
          select: { code: true, category: true },
        },
      },
      orderBy: { effectiveFrom: 'desc' },
    })

    // Get employees for this worksite (or all if no worksite)
    const employeeWhere: Record<string, unknown> = {
      status: 'ACTIVE',
      deletedAt: null,
    }

    if (payrollRun.worksiteId) {
      employeeWhere.employment = { worksiteId: payrollRun.worksiteId }
    }

    const employees = await prisma.employee.findMany({
      where: employeeWhere as any,
      include: {
        salaryProfile: true,
        employment: true,
      },
    })

    // Get attendance data for the period
    const [periodYear, periodMonth] = payrollRun.period.split('-').map(Number)
    const periodStart = new Date(periodYear, periodMonth - 1, 1)
    const periodEnd = new Date(periodYear, periodMonth, 0) // Last day of month

    const attendanceRecords = await prisma.attendanceRecord.findMany({
      where: {
        date: { gte: periodStart, lte: periodEnd },
        ...(payrollRun.worksiteId ? { worksiteId: payrollRun.worksiteId } : {}),
      },
    })

    // Group attendance by employee
    const attendanceByEmployee = new Map<string, typeof attendanceRecords>()
    for (const record of attendanceRecords) {
      const list = attendanceByEmployee.get(record.employeeId) || []
      list.push(record)
      attendanceByEmployee.set(record.employeeId, list)
    }

    let totalGross = 0
    let totalNet = 0
    let totalTax = 0

    // Calculate payroll for each employee
    await prisma.$transaction(async (tx: any) => {
      // Delete existing items for recalculation
      await tx.payrollItem.deleteMany({
        where: { payrollRunId: id },
      })

      for (const employee of employees) {
        const salary = employee.salaryProfile
        if (!salary) continue

        const empAttendance = attendanceByEmployee.get(employee.id) || []

        // Sum attendance data
        let workedDays = 0
        let workedHours = 0
        let overtimeHours = 0
        let nightHours = 0
        let holidayHours = 0

        for (const att of empAttendance) {
          if (att.attendanceType === 'NORMAL' || att.attendanceType === 'OVERTIME') {
            workedDays++
          }
          workedHours += Number(att.totalHours)
          overtimeHours += Number(att.overtimeHours)
          nightHours += Number(att.nightHours)
          if (att.attendanceType === 'HOLIDAY') {
            holidayHours += Number(att.totalHours)
          }
        }

        // Calculate base pay
        let basePay = 0
        const paymentType = salary.paymentType

        if (paymentType === 'MONTHLY') {
          basePay = Number(salary.grossSalary || salary.netSalary || 0)
        } else if (paymentType === 'DAILY') {
          basePay = Number(salary.dailyRate || 0) * workedDays
        } else if (paymentType === 'HOURLY') {
          basePay = Number(salary.hourlyRate || 0) * workedHours
        }

        // Add overtime, night, holiday premiums
        const hourlyBase = Number(salary.hourlyRate || 0) || (basePay / Math.max(workedHours, 1))
        const overtimePay = overtimeHours * hourlyBase * (Number(salary.overtimeMultiplier) - 1)
        const nightPay = nightHours * hourlyBase * (Number(salary.nightMultiplier) - 1)
        const holidayPay = holidayHours * hourlyBase * (Number(salary.holidayMultiplier) - 1)

        // Calculate gross and tax
        const taxStatus = (salary.taxStatus || 'RESIDENT') as TaxStatus
        let grossAmount: number
        let netAmount: number
        let ndflAmount: number

        try {
          if (salary.grossSalary && paymentType === 'MONTHLY') {
            // Gross-based calculation
            grossAmount = basePay + overtimePay + nightPay + holidayPay
            const result = grossToNet(grossAmount, taxStatus, ruleVersions as PayrollRuleVersionData[])
            netAmount = result.netSalary
            ndflAmount = result.ndflAmount
          } else if (salary.netSalary && paymentType === 'MONTHLY') {
            // Net-based calculation: first calculate gross from base net
            const baseResult = netToGross(basePay, taxStatus, ruleVersions as PayrollRuleVersionData[])
            grossAmount = baseResult.grossSalary + overtimePay + nightPay + holidayPay
            const finalResult = grossToNet(grossAmount, taxStatus, ruleVersions as PayrollRuleVersionData[])
            netAmount = finalResult.netSalary
            ndflAmount = finalResult.ndflAmount
          } else {
            // Daily/hourly
            grossAmount = basePay + overtimePay + nightPay + holidayPay
            const result = grossToNet(grossAmount, taxStatus, ruleVersions as PayrollRuleVersionData[])
            netAmount = result.netSalary
            ndflAmount = result.ndflAmount
          }
        } catch {
          // Fallback if tax rules not found
          grossAmount = basePay + overtimePay + nightPay + holidayPay
          const defaultRate = taxStatus === 'RESIDENT' ? 0.13 : 0.30
          ndflAmount = Math.round(grossAmount * defaultRate * 100) / 100
          netAmount = grossAmount - ndflAmount
        }

        const payrollItem = await tx.payrollItem.create({
          data: {
            payrollRunId: id,
            employeeId: employee.id,
            baseSalary: basePay,
            workedDays,
            workedHours,
            overtimeHours,
            nightHours,
            holidayHours,
            grossAmount,
            netAmount,
            ndflAmount,
            totalEarnings: overtimePay + nightPay + holidayPay,
            totalDeductions: 0,
          },
        })

        // Create earning entries for premiums
        if (overtimePay > 0) {
          await tx.earning.create({
            data: {
              payrollItemId: payrollItem.id,
              code: 'OVERTIME',
              name: 'Overtime Premium',
              amount: overtimePay,
            },
          })
        }

        if (nightPay > 0) {
          await tx.earning.create({
            data: {
              payrollItemId: payrollItem.id,
              code: 'NIGHT',
              name: 'Night Shift Premium',
              amount: nightPay,
            },
          })
        }

        if (holidayPay > 0) {
          await tx.earning.create({
            data: {
              payrollItemId: payrollItem.id,
              code: 'HOLIDAY',
              name: 'Holiday Premium',
              amount: holidayPay,
            },
          })
        }

        // Create NDFL deduction entry
        if (ndflAmount > 0) {
          await tx.deduction.create({
            data: {
              payrollItemId: payrollItem.id,
              code: 'NDFL',
              name: `NDFL (${taxStatus})`,
              amount: ndflAmount,
            },
          })
        }

        totalGross += grossAmount
        totalNet += netAmount
        totalTax += ndflAmount
      }

      // Update payroll run totals
      await tx.payrollRun.update({
        where: { id },
        data: {
          status: 'CALCULATED',
          totalGross: Math.round(totalGross * 100) / 100,
          totalNet: Math.round(totalNet * 100) / 100,
          totalTax: Math.round(totalTax * 100) / 100,
        },
      })
    })

    // Fetch the full updated payroll run
    const updatedRun = await prisma.payrollRun.findUnique({
      where: { id },
      include: {
        worksite: {
          select: { id: true, code: true, name: true },
        },
        items: {
          include: {
            employee: {
              select: {
                id: true,
                employeeNo: true,
                firstName: true,
                lastName: true,
              },
            },
            earnings: true,
            deductions: true,
          },
          orderBy: { employee: { lastName: 'asc' } },
        },
      },
    })

    await createAuditLog({
      userId: user.id,
      action: 'CALCULATE',
      entity: 'PayrollRun',
      entityId: id,
      newValues: {
        employeesProcessed: employees.length,
        totalGross,
        totalNet,
        totalTax,
      },
    })

    return success(updatedRun)
  } catch (err) {
    console.error('POST /api/payroll/[id] error:', err)
    return error('Failed to calculate payroll', 500)
  }
}
