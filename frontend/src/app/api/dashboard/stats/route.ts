import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success, error } from '@/lib/api-response'
import { getCurrentUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) return error('Unauthorized', 401)

    const now = new Date()
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    const [
      totalEmployees,
      activeEmployees,
      totalWorksites,
      employeesByStatus,
      employeesByNationality,
      employeesBySite,
      expiringDocuments,
      criticalAlerts,
      warningAlerts,
      openAssetAssignments,
    ] = await Promise.all([
      // Total employees
      prisma.employee.count({ where: { deletedAt: null } }),

      // Active employees
      prisma.employee.count({ where: { status: 'ACTIVE', deletedAt: null } }),

      // Total active worksites
      prisma.worksite.count({ where: { status: 'ACTIVE', deletedAt: null } }),

      // Employees by status (ACTIVE, TERMINATED, ON_LEAVE, etc.)
      prisma.employee.groupBy({
        by: ['status'],
        _count: { status: true },
        where: { deletedAt: null },
      }),

      // Employees by nationality
      prisma.employee.groupBy({
        by: ['nationalityId'],
        _count: { nationalityId: true },
        where: { status: 'ACTIVE', deletedAt: null, nationalityId: { not: null } },
        orderBy: { _count: { nationalityId: 'desc' } },
        take: 10,
      }),

      // Employees by worksite
      prisma.employeeEmployment.groupBy({
        by: ['worksiteId'],
        _count: { worksiteId: true },
        where: {
          worksiteId: { not: null },
          employee: { status: 'ACTIVE', deletedAt: null },
        },
        orderBy: { _count: { worksiteId: 'desc' } },
      }),

      // Expiring documents (within 30 days)
      prisma.employeeDocument.findMany({
        where: {
          deletedAt: null,
          expiryDate: { lte: thirtyDaysFromNow, gte: now },
          employee: { status: 'ACTIVE', deletedAt: null },
        },
        include: {
          employee: { select: { firstName: true, lastName: true, employeeNo: true } },
          documentType: { select: { nameTr: true, nameRu: true, nameEn: true } },
        },
        orderBy: { expiryDate: 'asc' },
        take: 20,
      }),

      // Critical alerts count
      prisma.alert.count({
        where: { severity: 'CRITICAL', isRead: false, isDismissed: false },
      }),

      // Warning alerts count
      prisma.alert.count({
        where: { severity: 'WARNING', isRead: false, isDismissed: false },
      }),

      // Open asset assignments (no return date)
      prisma.assetAssignment.count({
        where: { returnDate: null },
      }),
    ])

    // Resolve nationality names
    const nationalityIds = employeesByNationality
      .map((n) => n.nationalityId)
      .filter((id): id is string => id !== null)

    const nationalities = nationalityIds.length > 0
      ? await prisma.nationality.findMany({
          where: { id: { in: nationalityIds } },
          select: { id: true, nameTr: true, nameRu: true, nameEn: true },
        })
      : []

    const natMap = new Map(nationalities.map((n) => [n.id, n]))

    // Resolve worksite names
    const worksiteIds = employeesBySite
      .map((s) => s.worksiteId)
      .filter((id): id is string => id !== null)

    const worksites = worksiteIds.length > 0
      ? await prisma.worksite.findMany({
          where: { id: { in: worksiteIds } },
          select: { id: true, name: true },
        })
      : []

    const siteMap = new Map(worksites.map((w) => [w.id, w]))

    const stats = {
      totalEmployees,
      activeEmployees,
      totalWorksites,
      criticalAlerts,
      warningAlerts,
      missingDocuments: 0, // TODO: calculate based on document requirements
      attendanceGaps: 0, // TODO: calculate from attendance records
      openAssets: openAssetAssignments,
      monthlyPayroll: 0, // TODO: calculate from latest payroll run

      byStatus: employeesByStatus.map((s) => ({
        status: s.status,
        count: s._count.status,
      })),

      byNationality: employeesByNationality.map((n) => {
        const nat = n.nationalityId ? natMap.get(n.nationalityId) : null
        return {
          name: nat ? nat.nameTr : 'Unknown',
          nameRu: nat?.nameRu || 'Unknown',
          nameEn: nat?.nameEn || 'Unknown',
          count: n._count.nationalityId,
        }
      }),

      bySite: employeesBySite.map((s) => {
        const site = s.worksiteId ? siteMap.get(s.worksiteId) : null
        return {
          name: site?.name || 'Unknown',
          count: s._count.worksiteId,
        }
      }),

      upcomingExpiries: expiringDocuments.map((doc) => {
        const daysLeft = Math.ceil(
          ((doc.expiryDate?.getTime() || 0) - now.getTime()) / (1000 * 60 * 60 * 24)
        )
        return {
          employeeName: `${doc.employee.firstName} ${doc.employee.lastName}`,
          employeeNo: doc.employee.employeeNo,
          documentType: doc.documentType.nameTr,
          documentTypeRu: doc.documentType.nameRu,
          documentTypeEn: doc.documentType.nameEn,
          expiryDate: doc.expiryDate?.toISOString() || '',
          daysLeft,
        }
      }),
    }

    return success(stats)
  } catch (err) {
    console.error('Dashboard stats error:', err)
    return error('FETCH_FAILED', 500)
  }
}
