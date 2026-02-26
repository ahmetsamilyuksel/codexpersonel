'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { DataTable, type Column } from '@/components/ui/data-table'
import { HelpTooltip } from '@/components/ui/help-tooltip'
import { useTranslations } from '@/hooks/use-translations'
import { useLocaleStore, getLocalizedName } from '@/store/locale-store'
import apiClient from '@/lib/api-client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Save,
  Building2,
  Users,
  Clock,
  Wallet,
  Package,
} from 'lucide-react'

interface WorksiteDetail {
  id: string
  code: string
  name: string
  address: string | null
  city: string | null
  region: string | null
  projectManager: string | null
  siteManager: string | null
  client: string | null
  status: string
  startDate: string | null
  endDate: string | null
  notes: string | null
  _count: {
    employments: number
    assets: number
    attendancePeriods: number
    payrollRuns: number
  }
}

interface EmployeeRow {
  id: string
  employeeNo: string
  firstName: string
  lastName: string
  phone: string | null
  status: string
  profession: { nameTr: string; nameRu: string; nameEn: string } | null
  department: { nameTr: string; nameRu: string; nameEn: string } | null
}

interface AttendancePeriodRow {
  id: string
  period: string
  status: string
  submittedAt: string | null
  approvedAt: string | null
  _count?: { records: number }
}

export default function WorksiteDetailPage() {
  const { t, locale } = useTranslations()
  const { locale: currentLocale } = useLocaleStore()
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const queryClient = useQueryClient()

  const [form, setForm] = useState({
    code: '',
    name: '',
    address: '',
    city: '',
    region: '',
    projectManager: '',
    siteManager: '',
    client: '',
    status: 'ACTIVE',
    startDate: '',
    endDate: '',
    notes: '',
  })
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Fetch worksite detail
  const { data: worksite, isLoading } = useQuery({
    queryKey: ['worksite', id],
    queryFn: async () => {
      const res = await apiClient.get(`/worksites/${id}`)
      return res.data.data as WorksiteDetail
    },
    enabled: !!id,
  })

  // Fetch employees at this worksite
  const { data: employeesData, isLoading: employeesLoading } = useQuery({
    queryKey: ['worksite-employees', id],
    queryFn: async () => {
      const res = await apiClient.get(`/employees?worksiteId=${id}&limit=100`)
      return res.data
    },
    enabled: !!id,
  })

  // Fetch attendance periods
  const { data: periodsData, isLoading: periodsLoading } = useQuery({
    queryKey: ['worksite-periods', id],
    queryFn: async () => {
      const res = await apiClient.get(`/attendance-periods?worksiteId=${id}&limit=50`)
      return res.data
    },
    enabled: !!id,
  })

  useEffect(() => {
    if (worksite) {
      setForm({
        code: worksite.code || '',
        name: worksite.name || '',
        address: worksite.address || '',
        city: worksite.city || '',
        region: worksite.region || '',
        projectManager: worksite.projectManager || '',
        siteManager: worksite.siteManager || '',
        client: worksite.client || '',
        status: worksite.status || 'ACTIVE',
        startDate: worksite.startDate ? worksite.startDate.slice(0, 10) : '',
        endDate: worksite.endDate ? worksite.endDate.slice(0, 10) : '',
        notes: worksite.notes || '',
      })
    }
  }, [worksite])

  const updateMutation = useMutation({
    mutationFn: (payload: typeof form) => apiClient.put(`/worksites/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worksite', id] })
      queryClient.invalidateQueries({ queryKey: ['worksites'] })
      setSaveSuccess(true)
      setSaveError('')
      setTimeout(() => setSaveSuccess(false), 3000)
    },
    onError: (err: any) => {
      setSaveError(err.response?.data?.error || 'Failed to save')
      setSaveSuccess(false)
    },
  })

  const handleSave = () => {
    if (!form.code || !form.name) {
      setSaveError('Code and Name are required')
      return
    }
    updateMutation.mutate({
      ...form,
      startDate: form.startDate || null as any,
      endDate: form.endDate || null as any,
    })
  }

  const updateField = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const employeeColumns: Column<EmployeeRow>[] = [
    {
      key: 'employeeNo',
      header: t('employee.employeeNo'),
      render: (item) => <span className="font-mono text-xs">{item.employeeNo}</span>,
    },
    {
      key: 'name',
      header: `${t('employee.firstName')} ${t('employee.lastName')}`,
      render: (item) => (
        <span className="font-medium">
          {item.firstName} {item.lastName}
        </span>
      ),
    },
    {
      key: 'profession',
      header: t('employee.profession'),
      render: (item) => getLocalizedName(item.profession, currentLocale),
    },
    {
      key: 'department',
      header: t('employee.department'),
      render: (item) => getLocalizedName(item.department, currentLocale),
    },
    {
      key: 'phone',
      header: t('employee.phone'),
      render: (item) => item.phone || '-',
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (item) => {
        const variants: Record<string, 'success' | 'secondary' | 'destructive'> = {
          ACTIVE: 'success',
          INACTIVE: 'secondary',
          TERMINATED: 'destructive',
        }
        return (
          <Badge variant={variants[item.status] || 'secondary'}>{item.status}</Badge>
        )
      },
    },
  ]

  const periodColumns: Column<AttendancePeriodRow>[] = [
    {
      key: 'period',
      header: t('attendance.period'),
      render: (item) => <span className="font-mono text-sm">{item.period}</span>,
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (item) => {
        const variants: Record<string, 'success' | 'secondary' | 'warning' | 'default'> = {
          OPEN: 'warning',
          SUBMITTED: 'default',
          APPROVED: 'success',
          LOCKED: 'secondary',
        }
        return (
          <Badge variant={variants[item.status] || 'secondary'}>{item.status}</Badge>
        )
      },
    },
    {
      key: 'submittedAt',
      header: t('attendance.submit'),
      render: (item) =>
        item.submittedAt ? new Date(item.submittedAt).toLocaleDateString() : '-',
    },
    {
      key: 'approvedAt',
      header: t('common.approved'),
      render: (item) =>
        item.approvedAt ? new Date(item.approvedAt).toLocaleDateString() : '-',
    },
  ]

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <svg className="h-8 w-8 animate-spin text-primary" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.push(`/${locale}/worksites`)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Building2 className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">{form.name || 'Worksite'}</h1>
              <p className="text-sm text-muted-foreground">{form.code}</p>
            </div>
            <HelpTooltip helpKey="worksite" />
          </div>
          <Button onClick={handleSave} loading={updateMutation.isPending}>
            <Save className="h-4 w-4 mr-1" />
            {t('common.save')}
          </Button>
        </div>

        {/* Messages */}
        {saveError && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {saveError}
          </div>
        )}
        {saveSuccess && (
          <div className="rounded-md bg-success/10 p-3 text-sm text-success">
            Saved successfully
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t('worksite.employeeCount')}</p>
                  <p className="text-2xl font-bold">{worksite?._count?.employments || 0}</p>
                </div>
                <Users className="h-8 w-8 text-blue-600 opacity-80" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t('asset.title')}</p>
                  <p className="text-2xl font-bold">{worksite?._count?.assets || 0}</p>
                </div>
                <Package className="h-8 w-8 text-cyan-600 opacity-80" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t('attendance.period')}</p>
                  <p className="text-2xl font-bold">{worksite?._count?.attendancePeriods || 0}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-600 opacity-80" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t('payroll.title')}</p>
                  <p className="text-2xl font-bold">{worksite?._count?.payrollRuns || 0}</p>
                </div>
                <Wallet className="h-8 w-8 text-green-600 opacity-80" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Edit Form */}
        <Card>
          <CardHeader>
            <CardTitle>{t('worksite.title')} - {t('common.edit')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <Input
                label={t('worksite.code')}
                value={form.code}
                onChange={(e) => updateField('code', e.target.value)}
                required
              />
              <Input
                label={t('worksite.name')}
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                required
              />
              <Input
                label={t('worksite.city')}
                value={form.city}
                onChange={(e) => updateField('city', e.target.value)}
              />
              <Input
                label={t('worksite.region')}
                value={form.region}
                onChange={(e) => updateField('region', e.target.value)}
              />
              <Input
                label={t('worksite.address')}
                value={form.address}
                onChange={(e) => updateField('address', e.target.value)}
              />
              <Input
                label={t('worksite.projectManager')}
                value={form.projectManager}
                onChange={(e) => updateField('projectManager', e.target.value)}
              />
              <Input
                label={t('worksite.siteManager')}
                value={form.siteManager}
                onChange={(e) => updateField('siteManager', e.target.value)}
              />
              <Input
                label={t('worksite.client')}
                value={form.client}
                onChange={(e) => updateField('client', e.target.value)}
              />
              <div>
                <label className="block text-sm font-medium mb-1">{t('common.status')}</label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                  value={form.status}
                  onChange={(e) => updateField('status', e.target.value)}
                >
                  <option value="ACTIVE">{t('common.active')}</option>
                  <option value="COMPLETED">{t('common.completed')}</option>
                  <option value="SUSPENDED">Suspended</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
              <Input
                label={t('common.startDate')}
                type="date"
                value={form.startDate}
                onChange={(e) => updateField('startDate', e.target.value)}
              />
              <Input
                label={t('common.endDate')}
                type="date"
                value={form.endDate}
                onChange={(e) => updateField('endDate', e.target.value)}
              />
            </div>
            <div className="mt-4">
              <Input
                label={t('common.notes')}
                value={form.notes}
                onChange={(e) => updateField('notes', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Employees at this Worksite */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle>{t('employee.title')}</CardTitle>
              {employeesData?.pagination && (
                <Badge variant="outline">{employeesData.pagination.total}</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={employeeColumns}
              data={employeesData?.data || []}
              loading={employeesLoading}
              onRowClick={(item) => router.push(`/${locale}/employees/${item.id}`)}
              emptyMessage={t('common.noData')}
            />
          </CardContent>
        </Card>

        {/* Attendance Periods */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <CardTitle>{t('attendance.period')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={periodColumns}
              data={periodsData?.data || []}
              loading={periodsLoading}
              emptyMessage={t('common.noData')}
            />
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
