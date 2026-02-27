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
import { useLocaleStore, getLocalizedName } from '@/store/locale-store'
import { useAuthStore } from '@/store/auth-store'
import apiClient from '@/lib/api-client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Bell,
  AlertTriangle,
  AlertCircle,
  Info,
  Search,
  RefreshCw,
  Eye,
  EyeOff,
  CheckCircle,
} from 'lucide-react'

interface AlertRow {
  id: string
  severity: string
  title: string
  message: string
  expiryDate: string | null
  isRead: boolean
  isDismissed: boolean
  createdAt: string
  employee: {
    id: string
    firstName: string
    lastName: string
    employeeNo: string
  }
  alertRule: {
    id: string
    code: string
    nameTr: string
    nameRu: string
    nameEn: string
  }
}

export default function AlertsPage() {
  const { t, locale } = useTranslations()
  const { locale: currentLocale } = useLocaleStore()
  const router = useRouter()
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [readFilter, setReadFilter] = useState('unread')
  const limit = 25

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['alerts', page, search, severityFilter, readFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        sort: 'createdAt',
        order: 'desc',
      })
      if (search) params.set('search', search)
      if (severityFilter) params.set('severity', severityFilter)
      if (readFilter === 'unread') params.set('isRead', 'false')
      if (readFilter === 'read') params.set('isRead', 'true')
      const res = await apiClient.get(`/alerts?${params}`)
      return res.data
    },
  })

  const markReadMutation = useMutation({
    mutationFn: (id: string) => apiClient.put(`/alerts/${id}`, { isRead: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  })

  const dismissMutation = useMutation({
    mutationFn: (id: string) => apiClient.put(`/alerts/${id}`, { isDismissed: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  })

  const generateMutation = useMutation({
    mutationFn: () => apiClient.post('/alerts'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  })

  const handleSearch = () => {
    setSearch(searchInput)
    setPage(1)
  }

  const getDaysLeft = (expiryDate: string | null) => {
    if (!expiryDate) return null
    const diff = Math.ceil(
      (new Date(expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    )
    return diff
  }

  const severityIcon = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return <AlertCircle className="h-4 w-4 text-destructive" />
      case 'WARNING':
        return <AlertTriangle className="h-4 w-4 text-warning" />
      default:
        return <Info className="h-4 w-4 text-blue-500" />
    }
  }

  const severityBadge = (severity: string) => {
    const variants: Record<string, 'destructive' | 'warning' | 'default'> = {
      CRITICAL: 'destructive',
      WARNING: 'warning',
      INFO: 'default',
    }
    return (
      <Badge variant={variants[severity] || 'default'}>
        {t(`alert.${severity.toLowerCase()}`)}
      </Badge>
    )
  }

  const columns: Column<AlertRow>[] = [
    {
      key: 'severity',
      header: '',
      className: 'w-8',
      render: (item) => severityIcon(item.severity),
    },
    {
      key: 'severityLabel',
      header: t('common.type'),
      render: (item) => severityBadge(item.severity),
    },
    {
      key: 'employee',
      header: t('employee.title'),
      render: (item) => (
        <div>
          <span className="font-medium">
            {item.employee.firstName} {item.employee.lastName}
          </span>
          <span className="text-xs text-muted-foreground ml-2">
            ({item.employee.employeeNo})
          </span>
        </div>
      ),
    },
    {
      key: 'alertType',
      header: t('alert.title'),
      render: (item) => getLocalizedName(item.alertRule, currentLocale),
    },
    {
      key: 'title',
      header: t('common.description'),
      render: (item) => (
        <span className={`text-sm ${item.isRead ? 'text-muted-foreground' : 'font-medium'}`}>
          {item.title}
        </span>
      ),
    },
    {
      key: 'expiryDate',
      header: t('document.expiryDate'),
      render: (item) => {
        if (!item.expiryDate) return '-'
        const daysLeft = getDaysLeft(item.expiryDate)
        return (
          <div className="text-sm">
            <div>{new Date(item.expiryDate).toLocaleDateString()}</div>
            {daysLeft !== null && (
              <Badge
                variant={
                  daysLeft <= 0 ? 'destructive' : daysLeft <= 7 ? 'warning' : 'secondary'
                }
              >
                {daysLeft <= 0
                  ? t('alert.expired')
                  : `${daysLeft} ${t('alert.daysLeft')}`}
              </Badge>
            )}
          </div>
        )
      },
    },
    {
      key: 'createdAt',
      header: t('common.date'),
      render: (item) => (
        <span className="text-xs text-muted-foreground">
          {new Date(item.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (item) => (
        <div className="flex items-center gap-1">
          {!item.isRead && (
            <Button
              variant="ghost"
              size="icon"
              title={t('alert.markRead')}
              onClick={(e) => {
                e.stopPropagation()
                markReadMutation.mutate(item.id)
              }}
            >
              <Eye className="h-4 w-4" />
            </Button>
          )}
          {!item.isDismissed && (
            <Button
              variant="ghost"
              size="icon"
              title={t('alert.dismiss')}
              onClick={(e) => {
                e.stopPropagation()
                dismissMutation.mutate(item.id)
              }}
            >
              <EyeOff className="h-4 w-4 text-muted-foreground" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  // Stats
  const alerts = data?.data || []
  const criticalCount = alerts.filter((a: AlertRow) => a.severity === 'CRITICAL').length
  const warningCount = alerts.filter((a: AlertRow) => a.severity === 'WARNING').length
  const infoCount = alerts.filter((a: AlertRow) => a.severity === 'INFO').length

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">{t('alert.title')}</h1>
            <HelpTooltip helpKey="alert" />
          </div>
          <Button
            onClick={() => generateMutation.mutate()}
            loading={generateMutation.isPending}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            {t('common.generateAlerts')}
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="cursor-pointer hover:border-destructive/50" onClick={() => { setSeverityFilter('CRITICAL'); setPage(1) }}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t('alert.critical')}</p>
                  <p className="text-2xl font-bold text-destructive">{criticalCount}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-destructive opacity-80" />
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-warning/50" onClick={() => { setSeverityFilter('WARNING'); setPage(1) }}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t('alert.warning')}</p>
                  <p className="text-2xl font-bold text-warning">{warningCount}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-warning opacity-80" />
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-blue-500/50" onClick={() => { setSeverityFilter('INFO'); setPage(1) }}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t('alert.info')}</p>
                  <p className="text-2xl font-bold text-blue-600">{infoCount}</p>
                </div>
                <Info className="h-8 w-8 text-blue-600 opacity-80" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-md">
                <Input
                  placeholder={t('common.search') + '...'}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button variant="outline" size="icon" onClick={handleSearch}>
                  <Search className="h-4 w-4" />
                </Button>
              </div>
              <select
                className="h-9 rounded-md border border-input bg-card px-3 text-sm"
                value={severityFilter}
                onChange={(e) => {
                  setSeverityFilter(e.target.value)
                  setPage(1)
                }}
              >
                <option value="">{t('common.all')} {t('common.severity')}</option>
                <option value="CRITICAL">{t('alert.critical')}</option>
                <option value="WARNING">{t('alert.warning')}</option>
                <option value="INFO">{t('alert.info')}</option>
              </select>
              <select
                className="h-9 rounded-md border border-input bg-card px-3 text-sm"
                value={readFilter}
                onChange={(e) => {
                  setReadFilter(e.target.value)
                  setPage(1)
                }}
              >
                <option value="">{t('common.all')}</option>
                <option value="unread">{t('common.unread')}</option>
                <option value="read">{t('common.readStatus')}</option>
              </select>
              {data?.pagination && (
                <div className="ml-auto text-sm text-muted-foreground">
                  {t('common.total')}:{' '}
                  <span className="font-medium">{data.pagination.total}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <DataTable
          columns={columns}
          data={data?.data || []}
          pagination={data?.pagination}
          onPageChange={setPage}
          loading={isLoading}
          onRowClick={(item) => router.push(`/${locale}/employees/${item.employee.id}`)}
          emptyMessage={t('common.noData')}
        />
      </div>
    </AppLayout>
  )
}
