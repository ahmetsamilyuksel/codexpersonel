import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success, error } from '@/lib/api-response'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    const employee = await prisma.employee.findUnique({
      where: { id, deletedAt: null },
      select: {
        id: true,
        employeeNo: true,
        firstName: true,
        lastName: true,
        employment: { select: { startDate: true } },
      },
    })

    if (!employee) return error('EMPLOYEE_NOT_FOUND', 404)

    // Fetch all payroll items for this employee
    const payrollItems = await prisma.payrollItem.findMany({
      where: { employeeId: id },
      include: {
        payrollRun: {
          select: { period: true, status: true },
        },
      },
      orderBy: { payrollRun: { period: 'asc' } },
    })

    // Fetch all hakkedis items for this employee
    const hakkedisSatir = await prisma.hakkedisSatir.findMany({
      where: { employeeId: id },
      include: {
        hakkedis: {
          select: { period: true, status: true },
        },
      },
      orderBy: { hakkedis: { period: 'asc' } },
    })

    // Build month-by-month data
    const monthMap: Record<string, { payroll: number; hakkedis: number; paid: number }> = {}

    // Add payroll data
    for (const item of payrollItems) {
      const period = item.payrollRun.period
      if (!monthMap[period]) monthMap[period] = { payroll: 0, hakkedis: 0, paid: 0 }
      monthMap[period].payroll += Number(item.netAmount) || 0

      // If payroll run is PAID or LOCKED, count as paid
      if (item.payrollRun.status === 'PAID' || item.payrollRun.status === 'LOCKED') {
        monthMap[period].paid += Number(item.netAmount) || 0
      }
    }

    // Add hakkedis data
    for (const item of hakkedisSatir) {
      const period = item.hakkedis.period || 'unknown'
      if (!monthMap[period]) monthMap[period] = { payroll: 0, hakkedis: 0, paid: 0 }
      monthMap[period].hakkedis += Number(item.distributionAmount) || Number(item.totalAmount) || 0

      // If hakkedis is APPROVED, count as paid
      if (item.hakkedis.status === 'APPROVED') {
        monthMap[period].paid += Number(item.distributionAmount) || Number(item.totalAmount) || 0
      }
    }

    // Sort by period and build array with cumulative balance
    const sortedPeriods = Object.keys(monthMap).sort()
    let cumulative = 0
    const months = sortedPeriods.map((period) => {
      const m = monthMap[period]
      const totalIncome = m.payroll + m.hakkedis
      const balance = totalIncome - m.paid
      cumulative += balance
      return {
        period,
        payroll: Math.round(m.payroll),
        hakkedis: Math.round(m.hakkedis),
        totalIncome: Math.round(totalIncome),
        paid: Math.round(m.paid),
        balance: Math.round(balance),
        cumulative: Math.round(cumulative),
      }
    })

    const totalPayroll = months.reduce((s, m) => s + m.payroll, 0)
    const totalHakkedis = months.reduce((s, m) => s + m.hakkedis, 0)
    const totalPaid = months.reduce((s, m) => s + m.paid, 0)
    const currentBalance = totalPayroll + totalHakkedis - totalPaid

    return success({
      employeeId: id,
      totalPayroll,
      totalHakkedis,
      totalPaid,
      currentBalance,
      months,
    })
  } catch (err) {
    console.error('GET /api/employees/[id]/financial error:', err)
    return error('FETCH_FAILED', 500)
  }
}
