'use client'

import React, { useState } from 'react'
import { AppLayout } from '@/components/layout/app-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { HelpTooltip } from '@/components/ui/help-tooltip'
import { useTranslations } from '@/hooks/use-translations'
import { useLocaleStore, getLocalizedName } from '@/store/locale-store'
import apiClient from '@/lib/api-client'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart3,
  Users,
  Clock,
  Wallet,
  FileWarning,
  Package,
  ArrowLeftRight,
  Download,
  FileSpreadsheet,
  X,
  Loader2,
  ChevronRight,
} from 'lucide-react'

interface ReportDefinition {
  key: string
  icon: React.ElementType
  labelKey: string
  descKey: string
  color: string
  filters: string[]
}

const REPORT_TYPES: ReportDefinition[] = [
  {
    key: 'EMPLOYEE_LIST',
    icon: Users,
    labelKey: 'report.employeeList',
    descKey: 'report.employeeListDesc',
    color: 'text-blue-600',
    filters: ['worksiteId', 'status'],
  },
  {
    key: 'ATTENDANCE_SUMMARY',
    icon: Clock,
    labelKey: 'report.attendanceSummary',
    descKey: 'report.attendanceSummaryDesc',
    color: 'text-cyan-600',
    filters: ['worksiteId', 'startDate', 'endDate'],
  },
  {
    key: 'PAYROLL_SUMMARY',
    icon: Wallet,
    labelKey: 'report.payrollSummary',
    descKey: 'report.payrollSummaryDesc',
    color: 'text-emerald-600',
    filters: ['payrollRunId'],
  },
  {
    key: 'EXPIRING_DOCUMENTS',
    icon: FileWarning,
    labelKey: 'report.expiringDocuments',
    descKey: 'report.expiringDocumentsDesc',
    color: 'text-red-600',
    filters: ['daysAhead'],
  },
  {
    key: 'ASSET_SUMMARY',
    icon: Package,
    labelKey: 'report.assetSummary',
    descKey: 'report.assetSummaryDesc',
    color: 'text-teal-600',
    filters: ['status', 'categoryId'],
  },
  {
    key: 'TRANSFER_HISTORY',
    icon: ArrowLeftRight,
    labelKey: 'report.transferHistory',
    descKey: 'report.transferHistoryDesc',
    color: 'text-violet-600',
    filters: ['employeeId', 'startDate', 'endDate'],
  },
]

const DEFAULT_DESCRIPTIONS: Record<string, string> = {
  EMPLOYEE_LIST:
    'Export a complete list of employees with their details, filtered by status or worksite.',
  ATTENDANCE_SUMMARY:
    'Generate attendance records summary with check-in/out times, overtime, and night hours.',
  PAYROLL_SUMMARY:
    'Export payroll run details including gross, net, taxes, earnings, and deductions per employee.',
  EXPIRING_DOCUMENTS:
    'List employee documents (passport, visa, permits) that are expiring within a specified timeframe.',
  ASSET_SUMMARY:
    'Export asset inventory with categories, status, current assignments, and worksite locations.',
  TRANSFER_HISTORY:
    'Generate transfer history report showing employee site transfers with dates and statuses.',
}

export default function ReportsPage() {
  const { t, locale } = useTranslations()
  const { locale: currentLocale } = useLocaleStore()

  const [selectedReport, setSelectedReport] = useState<ReportDefinition | null>(null)
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [generating, setGenerating] = useState(false)
  const [exportError, setExportError] = useState('')

  // Fetch worksites for filter dropdowns
  const { data: worksitesData } = useQuery({
    queryKey: ['worksites-list'],
    queryFn: async () => {
      const res = await apiClient.get('/worksites?limit=200&status=ACTIVE')
      return res.data
    },
  })

  // Fetch asset categories for asset report filter
  const { data: categoriesData } = useQuery({
    queryKey: ['asset-categories-list'],
    queryFn: async () => {
      const res = await apiClient.get('/asset-categories?limit=100')
      return res.data
    },
    enabled: selectedReport?.key === 'ASSET_SUMMARY',
  })

  // Fetch payroll runs for payroll report filter
  const { data: payrollRunsData } = useQuery({
    queryKey: ['payroll-runs-for-report'],
    queryFn: async () => {
      const res = await apiClient.get('/payroll?limit=100')
      return res.data
    },
    enabled: selectedReport?.key === 'PAYROLL_SUMMARY',
  })

  const worksites = worksitesData?.data || []
  const categories = categoriesData?.data || []
  const payrollRuns = payrollRunsData?.data || []

  const updateFilter = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const handleSelectReport = (report: ReportDefinition) => {
    setSelectedReport(report)
    setFilters({})
    setExportError('')
  }

  const handleExport = async () => {
    if (!selectedReport) return

    setGenerating(true)
    setExportError('')

    try {
      // Build clean filters object
      const cleanFilters: Record<string, unknown> = {}
      Object.entries(filters).forEach(([key, value]) => {
        if (value) {
          if (key === 'daysAhead') {
            cleanFilters[key] = parseInt(value) || 30
          } else {
            cleanFilters[key] = value
          }
        }
      })

      const res = await apiClient.post(
        '/reports/export',
        {
          reportType: selectedReport.key,
          filters: cleanFilters,
          locale: currentLocale,
        },
        { responseType: 'blob' }
      )

      // Extract filename from content-disposition header
      const contentDisposition = res.headers['content-disposition']
      let fileName = `report_${selectedReport.key.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.xlsx`
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?(.+?)"?$/)
        if (match) fileName = match[1]
      }

      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', fileName)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      const errorMessage =
        err.response?.status === 404
          ? t('report.noData') || 'No data found for the specified filters'
          : t('report.exportError') || 'Failed to generate report'
      setExportError(errorMessage)
    } finally {
      setGenerating(false)
    }
  }

  const renderFilterPanel = () => {
    if (!selectedReport) return null

    return (
      <Card className="border-primary/30">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <selectedReport.icon className={`h-5 w-5 ${selectedReport.color}`} />
              <CardTitle className="text-base">
                {t(selectedReport.labelKey) || selectedReport.key.replace(/_/g, ' ')}
              </CardTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setSelectedReport(null)
                setFilters({})
                setExportError('')
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {exportError && (
            <div className="mb-3 rounded-md bg-destructive/10 p-2 text-sm text-destructive">
              {exportError}
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
            {selectedReport.filters.includes('worksiteId') && (
              <div>
                <label className="block text-sm font-medium mb-1">
                  {t('employment.worksite')}
                </label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                  value={filters.worksiteId || ''}
                  onChange={(e) => updateFilter('worksiteId', e.target.value)}
                >
                  <option value="">{t('common.all')}</option>
                  {worksites.map((ws: any) => (
                    <option key={ws.id} value={ws.id}>
                      {ws.code} - {ws.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selectedReport.filters.includes('status') && (
              <div>
                <label className="block text-sm font-medium mb-1">
                  {t('common.status')}
                </label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                  value={filters.status || ''}
                  onChange={(e) => updateFilter('status', e.target.value)}
                >
                  <option value="">{t('common.all')}</option>
                  {selectedReport.key === 'ASSET_SUMMARY' ? (
                    <>
                      <option value="AVAILABLE">{t('asset.available') || 'Available'}</option>
                      <option value="ASSIGNED">{t('asset.assigned') || 'Assigned'}</option>
                      <option value="DAMAGED">{t('asset.damaged') || 'Damaged'}</option>
                      <option value="LOST">{t('asset.lost') || 'Lost'}</option>
                      <option value="DISPOSED">{t('asset.disposed') || 'Disposed'}</option>
                    </>
                  ) : (
                    <>
                      <option value="ACTIVE">{t('common.active')}</option>
                      <option value="INACTIVE">{t('common.inactive')}</option>
                      <option value="TERMINATED">{t('common.completed')}</option>
                    </>
                  )}
                </select>
              </div>
            )}

            {selectedReport.filters.includes('startDate') && (
              <Input
                label={t('common.startDate') || 'Start Date'}
                type="date"
                value={filters.startDate || ''}
                onChange={(e) => updateFilter('startDate', e.target.value)}
              />
            )}

            {selectedReport.filters.includes('endDate') && (
              <Input
                label={t('common.endDate') || 'End Date'}
                type="date"
                value={filters.endDate || ''}
                onChange={(e) => updateFilter('endDate', e.target.value)}
              />
            )}

            {selectedReport.filters.includes('daysAhead') && (
              <Input
                label={t('report.daysAhead') || 'Days Ahead'}
                type="number"
                value={filters.daysAhead || '30'}
                onChange={(e) => updateFilter('daysAhead', e.target.value)}
              />
            )}

            {selectedReport.filters.includes('categoryId') && (
              <div>
                <label className="block text-sm font-medium mb-1">
                  {t('asset.category')}
                </label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                  value={filters.categoryId || ''}
                  onChange={(e) => updateFilter('categoryId', e.target.value)}
                >
                  <option value="">{t('common.all')}</option>
                  {categories.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {getLocalizedName(c, currentLocale)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selectedReport.filters.includes('payrollRunId') && (
              <div>
                <label className="block text-sm font-medium mb-1">
                  {t('payroll.title') || 'Payroll Run'}
                </label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                  value={filters.payrollRunId || ''}
                  onChange={(e) => updateFilter('payrollRunId', e.target.value)}
                >
                  <option value="">-- {t('common.select') || 'Select'} --</option>
                  {payrollRuns.map((pr: any) => (
                    <option key={pr.id} value={pr.id}>
                      {pr.period} - {pr.status}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selectedReport.filters.includes('employeeId') && (
              <Input
                label={t('employee.title') || 'Employee ID'}
                placeholder={t('employee.title') || 'Employee ID...'}
                value={filters.employeeId || ''}
                onChange={(e) => updateFilter('employeeId', e.target.value)}
              />
            )}
          </div>

          <Button onClick={handleExport} disabled={generating}>
            {generating ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4 mr-1" />
            )}
            {generating
              ? t('report.generating') || 'Generating...'
              : t('report.exportExcel') || 'Export to Excel'}
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">{t('report.title') || 'Reports'}</h1>
          <HelpTooltip helpKey="report" />
        </div>

        {/* Filter Panel (when report selected) */}
        {selectedReport && renderFilterPanel()}

        {/* Report Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {REPORT_TYPES.map((report) => (
            <Card
              key={report.key}
              className={`cursor-pointer transition-all hover:shadow-md hover:border-primary/30 ${
                selectedReport?.key === report.key ? 'border-primary ring-2 ring-primary/20' : ''
              }`}
              onClick={() => handleSelectReport(report)}
            >
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className={`${report.color} shrink-0`}>
                    <report.icon className="h-8 w-8" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base mb-1">
                      {t(report.labelKey) || report.key.replace(/_/g, ' ')}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {t(report.descKey) || DEFAULT_DESCRIPTIONS[report.key] || ''}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 mt-1" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  )
}
