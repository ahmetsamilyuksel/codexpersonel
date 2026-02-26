import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { error } from '@/lib/api-response'
import { getCurrentUser } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'
import * as XLSX from 'xlsx'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) return error('Unauthorized', 401)

    const body = await request.json()
    const { reportType, filters = {}, locale = 'tr' } = body

    let data: Record<string, unknown>[] = []
    let sheetName = 'Report'
    let fileName = 'report'

    switch (reportType) {
      case 'EMPLOYEE_LIST': {
        const employees = await prisma.employee.findMany({
          where: {
            deletedAt: null,
            ...(filters.status && { status: filters.status }),
            ...(filters.nationalityId && { nationalityId: filters.nationalityId }),
            ...(filters.worksiteId && {
              employment: { worksiteId: filters.worksiteId },
            }),
          },
          include: {
            nationality: true,
            profession: true,
            department: true,
            employment: { include: { worksite: true } },
            workStatus: true,
            identity: true,
          },
          orderBy: { employeeNo: 'asc' },
        })

        const nameKey = locale === 'ru' ? 'nameRu' : locale === 'en' ? 'nameEn' : 'nameTr'
        data = employees.map((e) => ({
          'Personel No': e.employeeNo,
          'Ad': e.firstName,
          'Soyad': e.lastName,
          'Baba Adı': e.patronymic || '',
          'Telefon': e.phone || '',
          'Uyruk': e.nationality?.[nameKey] || '',
          'Meslek': e.profession?.[nameKey] || '',
          'Departman': e.department?.[nameKey] || '',
          'Şantiye': e.employment?.worksite?.name || '',
          'Çalışma Statüsü': e.workStatus?.workStatusType || '',
          'Pasaport No': e.identity?.passportNo || '',
          'SNILS': e.identity?.snils || '',
          'INN': e.identity?.inn || '',
          'Durum': e.status,
        }))
        sheetName = 'Personel Listesi'
        fileName = `personel_listesi_${new Date().toISOString().slice(0, 10)}`
        break
      }

      case 'ATTENDANCE_SUMMARY': {
        const records = await prisma.attendanceRecord.findMany({
          where: {
            ...(filters.worksiteId && { worksiteId: filters.worksiteId }),
            ...(filters.startDate && filters.endDate && {
              date: {
                gte: new Date(filters.startDate),
                lte: new Date(filters.endDate),
              },
            }),
          },
          include: {
            employee: { select: { employeeNo: true, firstName: true, lastName: true } },
            worksite: { select: { name: true } },
          },
          orderBy: [{ date: 'asc' }, { employeeId: 'asc' }],
        })

        data = records.map((r) => ({
          'Personel No': r.employee.employeeNo,
          'Ad Soyad': `${r.employee.firstName} ${r.employee.lastName}`,
          'Tarih': r.date.toISOString().slice(0, 10),
          'Giriş': r.checkIn?.toISOString().slice(11, 16) || '',
          'Çıkış': r.checkOut?.toISOString().slice(11, 16) || '',
          'Toplam Saat': Number(r.totalHours),
          'Fazla Mesai': Number(r.overtimeHours),
          'Gece Saat': Number(r.nightHours),
          'Tip': r.attendanceType,
          'Şantiye': r.worksite?.name || '',
          'Not': r.notes || '',
        }))
        sheetName = 'Puantaj'
        fileName = `puantaj_${filters.startDate || 'all'}_${filters.endDate || 'all'}`
        break
      }

      case 'PAYROLL_SUMMARY': {
        const payrollRun = filters.payrollRunId
          ? await prisma.payrollRun.findUnique({
              where: { id: filters.payrollRunId },
              include: {
                items: {
                  include: {
                    employee: { select: { employeeNo: true, firstName: true, lastName: true } },
                    earnings: true,
                    deductions: true,
                  },
                },
              },
            })
          : null

        if (payrollRun) {
          data = payrollRun.items.map((item) => ({
            'Personel No': item.employee.employeeNo,
            'Ad Soyad': `${item.employee.firstName} ${item.employee.lastName}`,
            'Temel Maaş': Number(item.baseSalary),
            'Çalışılan Gün': item.workedDays,
            'Çalışılan Saat': Number(item.workedHours),
            'Fazla Mesai Saat': Number(item.overtimeHours),
            'Brüt Maaş': Number(item.grossAmount),
            'NDFL': Number(item.ndflAmount),
            'Net Maaş': Number(item.netAmount),
            'Ek Ödemeler': Number(item.totalEarnings),
            'Kesintiler': Number(item.totalDeductions),
            'Manuel Düzeltme': Number(item.manualAdjustment),
          }))
        }
        sheetName = 'Bordro'
        fileName = `bordro_${payrollRun?.period || 'all'}`
        break
      }

      case 'EXPIRING_DOCUMENTS': {
        const daysAhead = filters.daysAhead || 30
        const threshold = new Date()
        threshold.setDate(threshold.getDate() + daysAhead)

        const docs = await prisma.employeeDocument.findMany({
          where: {
            deletedAt: null,
            expiryDate: { lte: threshold },
            employee: { status: 'ACTIVE', deletedAt: null },
          },
          include: {
            employee: { select: { employeeNo: true, firstName: true, lastName: true } },
            documentType: true,
          },
          orderBy: { expiryDate: 'asc' },
        })

        const nameKey = locale === 'ru' ? 'nameRu' : locale === 'en' ? 'nameEn' : 'nameTr'
        data = docs.map((d) => {
          const daysLeft = Math.ceil(((d.expiryDate?.getTime() || 0) - Date.now()) / (1000 * 60 * 60 * 24))
          return {
            'Personel No': d.employee.employeeNo,
            'Ad Soyad': `${d.employee.firstName} ${d.employee.lastName}`,
            'Belge Türü': d.documentType[nameKey],
            'Belge No': d.documentNo || '',
            'Bitiş Tarihi': d.expiryDate?.toISOString().slice(0, 10) || '',
            'Kalan Gün': daysLeft,
            'Durum': daysLeft <= 0 ? 'EXPIRED' : daysLeft <= 7 ? 'CRITICAL' : 'WARNING',
          }
        })
        sheetName = 'Biten Belgeler'
        fileName = `biten_belgeler_${new Date().toISOString().slice(0, 10)}`
        break
      }

      case 'ASSET_SUMMARY': {
        const assets = await prisma.asset.findMany({
          where: {
            deletedAt: null,
            ...(filters.status && { status: filters.status }),
            ...(filters.categoryId && { categoryId: filters.categoryId }),
          },
          include: {
            category: true,
            worksite: { select: { name: true } },
            assignments: {
              where: { returnDate: null },
              include: {
                employee: { select: { employeeNo: true, firstName: true, lastName: true } },
              },
              take: 1,
            },
          },
          orderBy: { assetNo: 'asc' },
        })

        const nameKey = locale === 'ru' ? 'nameRu' : locale === 'en' ? 'nameEn' : 'nameTr'
        data = assets.map((a) => {
          const currentAssignee = a.assignments[0]?.employee
          return {
            'Zimmet No': a.assetNo,
            'Kategori': a.category[nameKey],
            'Ad': a.name,
            'Marka': a.brand || '',
            'Model': a.model || '',
            'Seri No': a.serialNo || '',
            'Durum': a.status,
            'Şantiye': a.worksite?.name || '',
            'Atanan Kişi': currentAssignee
              ? `${currentAssignee.firstName} ${currentAssignee.lastName} (${currentAssignee.employeeNo})`
              : '',
          }
        })
        sheetName = 'Zimmetler'
        fileName = `zimmetler_${new Date().toISOString().slice(0, 10)}`
        break
      }

      case 'TRANSFER_HISTORY': {
        const transfers = await prisma.employeeSiteTransfer.findMany({
          where: {
            ...(filters.employeeId && { employeeId: filters.employeeId }),
            ...(filters.startDate && filters.endDate && {
              transferDate: {
                gte: new Date(filters.startDate),
                lte: new Date(filters.endDate),
              },
            }),
          },
          include: {
            employee: { select: { employeeNo: true, firstName: true, lastName: true } },
            fromWorksite: { select: { name: true } },
            toWorksite: { select: { name: true } },
          },
          orderBy: { transferDate: 'desc' },
        })

        data = transfers.map((tr) => ({
          'Personel No': tr.employee.employeeNo,
          'Ad Soyad': `${tr.employee.firstName} ${tr.employee.lastName}`,
          'Nereden': tr.fromWorksite.name,
          'Nereye': tr.toWorksite.name,
          'Tarih': tr.transferDate.toISOString().slice(0, 10),
          'Tip': tr.transferType,
          'Neden': tr.reason || '',
          'Durum': tr.status,
        }))
        sheetName = 'Transferler'
        fileName = `transferler_${new Date().toISOString().slice(0, 10)}`
        break
      }

      default:
        return error(`Unknown report type: ${reportType}`, 400)
    }

    if (data.length === 0) {
      return error('No data found for the specified filters', 404)
    }

    // Generate Excel
    const ws = XLSX.utils.json_to_sheet(data)

    // Auto-size columns
    const colWidths = Object.keys(data[0] || {}).map((key) => {
      const maxLen = Math.max(
        key.length,
        ...data.map((row) => String(row[key] ?? '').length)
      )
      return { wch: Math.min(maxLen + 2, 40) }
    })
    ws['!cols'] = colWidths

    // Print settings for A4
    ws['!printHeader'] = [1, 1]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, sheetName)

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    await createAuditLog({
      userId: user.id,
      action: 'EXPORT',
      entity: 'Report',
      newValues: { reportType, filters, rowCount: data.length },
    })

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}.xlsx"`,
      },
    })
  } catch (err) {
    console.error('Report export error:', err)
    return error('Failed to generate report', 500)
  }
}
