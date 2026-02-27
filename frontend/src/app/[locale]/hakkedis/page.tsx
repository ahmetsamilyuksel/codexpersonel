'use client'

import React, { useState, useCallback } from 'react'
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
import apiClient from '@/lib/api-client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  FileText,
  Plus,
  Search,
  X,
  Check,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react'

interface HakkedisRow {
  id: string
  period: string | null
  status: string
  totalAmount: string
  notes: string | null
  createdAt: string
  worksite: {
    id: string
    code: string
    name: string
  }
  _count: {
    items: number
  }
}

export default function HakkedisPage() {
  const { t, locale } = useTranslations()
  const router = useRouter()
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [worksiteFilter, setWorksiteFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [periodFilter, setPeriodFilter] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newHakkedis, setNewHakkedis] = useState({
    worksiteId: '',
    period: '',
    notes: '',
  })
  const [formError, setFormError] = useState('')
  const limit = 25

  const { data, isLoading } = useQuery({
    queryKey: ['hakkedis', page, worksiteFilter, statusFilter, periodFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      })
      if (worksiteFilter) params.set('worksiteId', worksiteFilter)
      if (statusFilter) params.set('status', statusFilter)
      if (periodFilter) params.set('period', periodFilter)
      const res = await apiClient.get(`/hakkedis?${params}`)
      return res.data
    },
  })

  const { data: worksitesData } = useQuery({
    queryKey: ['worksites-list'],
    queryFn: async () => {
      const res = await apiClient.get('/worksites?limit=200&status=ACTIVE')
      return res.data
    },
  })

  const createMutation = useMutation({
    mutationFn: (payload: typeof newHakkedis) =>
      apiClient.post('/hakkedis', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hakkedis'] })
      setShowAdd(false)
      setNewHakkedis({ worksiteId: '', period: '', notes: '' })
      setFormError('')
    },
    onError: (err: any) => {
      const code = err.response?.data?.error || ''
      const errorMap: Record<string, string> = {
        'UNAUTHORIZED': t('common.unauthorized'),
        'FIELDS_REQUIRED': t('common.fieldsRequired'),
        'WORKSITE_NOT_FOUND': t('common.worksiteNotFound'),
        'CREATE_FAILED': t('common.createFailed'),
      }
      setFormError(errorMap[code] || t('common.createFailed'))
    },
  })

  const worksites = worksitesData?.data || []

  const formatCurrency = (val: string | number) =>
    new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      maximumFractionDigits: 0,
    }).format(Number(val) || 0)

  const statusBadge = (status: string) => {
    const variants: Record<string, 'warning' | 'success' | 'default' | 'destructive' | 'secondary'> = {
      DRAFT: 'warning',
      SUBMITTED: 'default',
      APPROVED: 'success',
      REJECTED: 'destructive',
      CANCELLED: 'secondary',
    }
    return (
      <Badge variant={variants[status] || 'secondary'}>
        {t(`hakkedis.${status.toLowerCase()}`) || status}
      </Badge>
    )
  }

  const columns: Column<HakkedisRow>[] = [
    {
      key: 'period',
      header: t('hakkedis.period'),
      render: (item) => (
        <span className="font-mono text-sm font-medium">
          {item.period || '-'}
        </span>
      ),
    },
    {
      key: 'worksite',
      header: t('employment.worksite'),
      render: (item) => (
        <div>
          <span className="font-medium">{item.worksite.name}</span>
          <span className="text-xs text-muted-foreground ml-1">
            ({item.worksite.code})
          </span>
        </div>
      ),
    },
    {
      key: 'totalAmount',
      header: t('hakkedis.totalAmount'),
      render: (item) => (
        <span className="font-medium">{formatCurrency(item.totalAmount)}</span>
      ),
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (item) => statusBadge(item.status),
    },
    {
      key: 'itemCount',
      header: t('hakkedis.itemCount'),
      render: (item) => (
        <Badge variant="secondary">{item._count.items}</Badge>
      ),
    },
    {
      key: 'notes',
      header: t('common.notes'),
      render: (item) => (
        <span className="text-sm text-muted-foreground truncate max-w-[200px] block">
          {item.notes || '-'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: t('common.createdAt'),
      render: (item) => new Date(item.createdAt).toLocaleDateString(),
    },
  ]

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">{t('hakkedis.title')}</h1>
            <HelpTooltip helpKey="hakkedis" />
          </div>
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-1" />
            {t('hakkedis.addNew')}
          </Button>
        </div>

        {/* Stats Cards */}
        {data?.data && data.data.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{t('common.total')}</p>
                    <p className="text-2xl font-bold">{data.pagination?.total || data.data.length}</p>
                  </div>
                  <FileText className="h-8 w-8 text-primary opacity-80" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{t('hakkedis.totalAmount')}</p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(data.data.reduce((s: number, h: any) => s + (Number(h.totalAmount) || 0), 0))}
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-success opacity-80" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{t('common.pending')}</p>
                    <p className="text-2xl font-bold text-amber-500">
                      {data.data.filter((h: any) => h.status === 'DRAFT' || h.status === 'SUBMITTED').length}
                    </p>
                  </div>
                  <Clock className="h-8 w-8 text-amber-500 opacity-80" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{t('hakkedis.approved')}</p>
                    <p className="text-2xl font-bold text-success">
                      {data.data.filter((h: any) => h.status === 'APPROVED').length}
                    </p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-success opacity-80" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap items-center gap-3">
              <select
                className="h-9 rounded-md border border-input bg-card px-3 text-sm min-w-[200px]"
                value={worksiteFilter}
                onChange={(e) => { setWorksiteFilter(e.target.value); setPage(1) }}
              >
                <option value="">{t('common.all')} {t('employment.worksite')}</option>
                {worksites.map((ws: any) => (
                  <option key={ws.id} value={ws.id}>
                    {ws.code} - {ws.name}
                  </option>
                ))}
              </select>
              <Input
                placeholder={`${t('hakkedis.period')} (YYYY-MM)`}
                value={periodFilter}
                onChange={(e) => { setPeriodFilter(e.target.value); setPage(1) }}
                className="w-[160px]"
              />
              <select
                className="h-9 rounded-md border border-input bg-card px-3 text-sm"
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
              >
                <option value="">{t('common.all')} {t('common.status')}</option>
                <option value="DRAFT">{t('hakkedis.draft')}</option>
                <option value="SUBMITTED">{t('hakkedis.submitted')}</option>
                <option value="APPROVED">{t('hakkedis.approved')}</option>
                <option value="REJECTED">{t('hakkedis.rejected')}</option>
              </select>
              {data?.pagination && (
                <div className="ml-auto text-sm text-muted-foreground">
                  {t('common.total')}: <span className="font-medium">{data.pagination.total}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Add Hakkedis Form */}
        {showAdd && (
          <Card className="border-primary/30">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  {t('hakkedis.addNew')}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => { setShowAdd(false); setFormError('') }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {formError && (
                <div className="mb-3 rounded-md bg-destructive/10 p-2 text-sm text-destructive">
                  {formError}
                </div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {t('employment.worksite')} <span className="text-destructive">*</span>
                  </label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                    value={newHakkedis.worksiteId}
                    onChange={(e) =>
                      setNewHakkedis((p) => ({ ...p, worksiteId: e.target.value }))
                    }
                  >
                    <option value="">--</option>
                    {worksites.map((ws: any) => (
                      <option key={ws.id} value={ws.id}>
                        {ws.code} - {ws.name}
                      </option>
                    ))}
                  </select>
                </div>
                <Input
                  label={t('hakkedis.period')}
                  placeholder="YYYY-MM"
                  value={newHakkedis.period}
                  onChange={(e) =>
                    setNewHakkedis((p) => ({ ...p, period: e.target.value }))
                  }
                />
                <Input
                  label={t('common.notes')}
                  value={newHakkedis.notes}
                  onChange={(e) =>
                    setNewHakkedis((p) => ({ ...p, notes: e.target.value }))
                  }
                />
              </div>
              <div className="flex items-center gap-2 mt-3">
                <Button
                  onClick={() => createMutation.mutate(newHakkedis)}
                  loading={createMutation.isPending}
                  disabled={!newHakkedis.worksiteId}
                >
                  <Check className="h-4 w-4 mr-1" />
                  {t('common.save')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => { setShowAdd(false); setFormError('') }}
                >
                  {t('common.cancel')}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Table */}
        <DataTable
          columns={columns}
          data={data?.data || []}
          pagination={data?.pagination}
          onPageChange={setPage}
          loading={isLoading}
          onRowClick={(item) => router.push(`/${locale}/hakkedis/${item.id}`)}
          emptyMessage={t('common.noData')}
        />
      </div>
    </AppLayout>
  )
}
