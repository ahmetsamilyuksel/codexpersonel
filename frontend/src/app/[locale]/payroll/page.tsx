'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { DataTable, type Column } from '@/components/ui/data-table'
import { HelpTooltip } from '@/components/ui/help-tooltip'
import { useTranslations } from '@/hooks/use-translations'
import { useLocaleStore } from '@/store/locale-store'
import { useAuthStore } from '@/store/auth-store'
import apiClient from '@/lib/api-client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Wallet,
  Calculator,
  CheckCircle,
  Lock,
  Unlock,
  Download,
  Plus,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface PayrollItemRow {
  id: string
  employeeId: string
  employee: {
    id: string
    employeeNo: string
    firstName: string
    lastName: string
  }
  baseSalary: string
  workedDays: number
  workedHours: string
  overtimeHours: string
  nightHours: string
  holidayHours: string
  grossAmount: string
  netAmount: string
  ndflAmount: string
  totalEarnings: string
  totalDeductions: string
  manualAdjustment: string
  manualNote: string | null
}

interface PayrollRunInfo {
  id: string
  period: string
  worksiteId: string | null
  status: string
  totalGross: string
  totalNet: string
  totalTax: string
  notes: string | null
  items: PayrollItemRow[]
}

export default function PayrollPage() {
  const { t, locale } = useTranslations()
  const router = useRouter()
  const queryClient = useQueryClient()

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [worksiteId, setWorksiteId] = useState('')
  const period = `${year}-${String(month).padStart(2, '0')}`

  const formatCurrency = (val: string | number) =>
    new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      maximumFractionDigits: 0,
    }).format(Number(val) || 0)

  // Fetch worksites
  const { data: worksitesData } = useQuery({
    queryKey: ['worksites-list'],
    queryFn: async () => {
      const res = await apiClient.get('/worksites?limit=200&status=ACTIVE')
      return res.data
    },
  })

  // Fetch payroll run
  const { data: payrollRun, isLoading } = useQuery({
    queryKey: ['payroll-run', period, worksiteId],
    queryFn: async () => {
      const params = new URLSearchParams({ period })
      if (worksiteId) params.set('worksiteId', worksiteId)
      const res = await apiClient.get(`/payroll?${params}`)
      const runs = res.data?.data || []
      if (runs.length > 0) {
        // Fetch full run with items
        const runRes = await apiClient.get(`/payroll/${runs[0].id}`)
        return runRes.data.data as PayrollRunInfo
      }
      return null
    },
    enabled: !!worksiteId,
  })

  const createMutation = useMutation({
    mutationFn: () =>
      apiClient.post('/payroll', { period, worksiteId: worksiteId || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-run', period, worksiteId] })
    },
  })

  const calculateMutation = useMutation({
    mutationFn: () =>
      apiClient.post(`/payroll/${payrollRun?.id}`, { action: 'calculate' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-run', period, worksiteId] })
    },
  })

  const approveMutation = useMutation({
    mutationFn: () =>
      apiClient.put(`/payroll/${payrollRun?.id}`, { status: 'APPROVED' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-run', period, worksiteId] })
    },
  })

  const lockMutation = useMutation({
    mutationFn: () =>
      apiClient.put(`/payroll/${payrollRun?.id}`, { status: 'PAID' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-run', period, worksiteId] })
    },
  })

  const handleExport = async () => {
    if (!payrollRun) return
    try {
      const res = await apiClient.post('/reports/export', { reportType: 'PAYROLL_SUMMARY', filters: { payrollRunId: payrollRun.id } }, {
        responseType: 'blob',
      })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `payroll_${period}_${worksiteId || 'all'}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch {
      // handle error
    }
  }

  const worksites = worksitesData?.data || []
  const items = payrollRun?.items || []
  const status = payrollRun?.status || 'NONE'
  const isLocked = status === 'LOCKED' || status === 'PAID'

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(year - 1) }
    else setMonth(month - 1)
  }
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(year + 1) }
    else setMonth(month + 1)
  }

  const statusBadge = (s: string) => {
    const variants: Record<string, 'secondary' | 'warning' | 'default' | 'success' | 'destructive'> = {
      DRAFT: 'warning',
      CALCULATED: 'default',
      APPROVED: 'success',
      PAID: 'success',
      LOCKED: 'secondary',
    }
    return <Badge variant={variants[s] || 'secondary'}>{t(`common.${s.toLowerCase()}`)}</Badge>
  }

  const columns: Column<PayrollItemRow>[] = [
    {
      key: 'employeeNo',
      header: t('employee.employeeNo'),
      render: (item) => (
        <span className="font-mono text-xs">{item.employee.employeeNo}</span>
      ),
    },
    {
      key: 'employee',
      header: t('employee.title'),
      render: (item) => (
        <span className="font-medium">
          {item.employee.firstName} {item.employee.lastName}
        </span>
      ),
    },
    {
      key: 'baseSalary',
      header: t('payroll.baseSalary'),
      render: (item) => formatCurrency(item.baseSalary),
    },
    {
      key: 'workedDays',
      header: t('payroll.workedDays'),
      render: (item) => item.workedDays,
    },
    {
      key: 'grossAmount',
      header: t('payroll.grossAmount'),
      render: (item) => (
        <span className="font-medium">{formatCurrency(item.grossAmount)}</span>
      ),
    },
    {
      key: 'ndflAmount',
      header: t('payroll.ndflAmount'),
      render: (item) => (
        <span className="text-destructive">{formatCurrency(item.ndflAmount)}</span>
      ),
    },
    {
      key: 'totalEarnings',
      header: t('payroll.totalEarnings'),
      render: (item) => (
        <span className="text-success">{formatCurrency(item.totalEarnings)}</span>
      ),
    },
    {
      key: 'totalDeductions',
      header: t('payroll.totalDeductions'),
      render: (item) => (
        <span className="text-destructive">{formatCurrency(item.totalDeductions)}</span>
      ),
    },
    {
      key: 'netAmount',
      header: t('payroll.netAmount'),
      render: (item) => (
        <span className="font-bold text-lg">{formatCurrency(item.netAmount)}</span>
      ),
    },
  ]

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">{t('payroll.title')}</h1>
            <HelpTooltip helpKey="payroll" />
          </div>
          <div className="flex items-center gap-2">
            {payrollRun && (
              <Button variant="outline" onClick={handleExport}>
                <Download className="h-4 w-4 mr-1" />
                {t('common.export')}
              </Button>
            )}
          </div>
        </div>

        {/* Selectors */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap items-center gap-4">
              {/* Period */}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={prevMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="font-mono text-lg font-semibold min-w-[120px] text-center">
                  {period}
                </div>
                <Button variant="outline" size="icon" onClick={nextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Worksite */}
              <select
                className="h-9 rounded-md border border-input bg-card px-3 text-sm min-w-[200px]"
                value={worksiteId}
                onChange={(e) => setWorksiteId(e.target.value)}
              >
                <option value="">-- {t('employment.worksite')} --</option>
                {worksites.map((ws: any) => (
                  <option key={ws.id} value={ws.id}>
                    {ws.code} - {ws.name}
                  </option>
                ))}
              </select>

              {/* Status */}
              {payrollRun && (
                <div className="flex items-center gap-2">
                  {statusBadge(status)}
                </div>
              )}

              {/* Actions */}
              <div className="ml-auto flex items-center gap-2">
                {!payrollRun && worksiteId && (
                  <Button onClick={() => createMutation.mutate()} loading={createMutation.isPending}>
                    <Plus className="h-4 w-4 mr-1" />
                    {t('payroll.run')}
                  </Button>
                )}
                {payrollRun && (status === 'DRAFT' || status === 'CALCULATED') && (
                  <Button
                    variant="outline"
                    onClick={() => calculateMutation.mutate()}
                    loading={calculateMutation.isPending}
                  >
                    <Calculator className="h-4 w-4 mr-1" />
                    {t('payroll.calculate')}
                  </Button>
                )}
                {payrollRun && status === 'CALCULATED' && (
                  <Button
                    variant="success"
                    onClick={() => approveMutation.mutate()}
                    loading={approveMutation.isPending}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    {t('common.approve')}
                  </Button>
                )}
                {payrollRun && status === 'APPROVED' && (
                  <Button
                    variant="outline"
                    onClick={() => lockMutation.mutate()}
                    loading={lockMutation.isPending}
                  >
                    <Lock className="h-4 w-4 mr-1" />
                    {t('payroll.lock')}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Totals */}
        {payrollRun && (
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">{t('payroll.grossAmount')}</p>
                <p className="text-2xl font-bold">{formatCurrency(payrollRun.totalGross)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">{t('payroll.ndflAmount')}</p>
                <p className="text-2xl font-bold text-destructive">
                  {formatCurrency(payrollRun.totalTax)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">{t('payroll.netAmount')}</p>
                <p className="text-2xl font-bold text-success">
                  {formatCurrency(payrollRun.totalNet)}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Payroll Chart */}
        {payrollRun && items.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('payroll.grossAmount')} / {t('payroll.netAmount')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={items.slice(0, 20).map((item) => ({
                  name: `${item.employee.firstName} ${item.employee.lastName?.charAt(0)}.`,
                  gross: Number(item.grossAmount) || 0,
                  net: Number(item.netAmount) || 0,
                  ndfl: Number(item.ndflAmount) || 0,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(value: number) =>
                      new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(value)
                    }
                  />
                  <Legend />
                  <Bar dataKey="gross" name={t('payroll.grossAmount')} fill="#3b82f6" />
                  <Bar dataKey="net" name={t('payroll.netAmount')} fill="#10b981" />
                  <Bar dataKey="ndfl" name={t('payroll.ndflAmount')} fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Payroll Items Table */}
        {worksiteId ? (
          <DataTable
            columns={columns}
            data={items}
            loading={isLoading}
            onRowClick={(item) => router.push(`/${locale}/employees/${item.employee.id}`)}
            emptyMessage={
              payrollRun
                ? t('common.noData')
                : t('common.createPayrollToBegin')
            }
          />
        ) : (
          <Card>
            <CardContent className="pt-4">
              <p className="text-center text-muted-foreground py-8">
                {t('common.selectWorksitePayroll')}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  )
}
