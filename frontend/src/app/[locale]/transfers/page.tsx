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
import { useAuthStore } from '@/store/auth-store'
import apiClient from '@/lib/api-client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeftRight,
  Plus,
  Search,
  CheckCircle,
  X,
  Check,
  ArrowRight,
} from 'lucide-react'

interface TransferRow {
  id: string
  transferDate: string
  transferType: string
  reason: string | null
  accommodationEffect: string | null
  salaryEffect: string | null
  status: string
  notes: string | null
  createdAt: string
  employee: {
    id: string
    employeeNo: string
    firstName: string
    lastName: string
  }
  fromWorksite: {
    id: string
    code: string
    name: string
  }
  toWorksite: {
    id: string
    code: string
    name: string
  }
}

export default function TransfersPage() {
  const { t, locale } = useTranslations()
  const router = useRouter()
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newTransfer, setNewTransfer] = useState({
    employeeId: '',
    fromWorksiteId: '',
    toWorksiteId: '',
    transferDate: '',
    transferType: 'PERMANENT',
    reason: '',
    accommodationEffect: '',
    salaryEffect: '',
    notes: '',
  })
  const [formError, setFormError] = useState('')
  const limit = 25

  const { data, isLoading } = useQuery({
    queryKey: ['transfers', page, search, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        sort: 'createdAt',
        order: 'desc',
      })
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)
      const res = await apiClient.get(`/transfers?${params}`)
      return res.data
    },
  })

  const { data: employeesData } = useQuery({
    queryKey: ['employees-for-transfer'],
    queryFn: async () => {
      const res = await apiClient.get('/employees?limit=500&status=ACTIVE&include=employment')
      return res.data
    },
    enabled: showAdd,
  })

  // Auto-fill "from" worksite when employee is selected
  const handleEmployeeChange = (employeeId: string) => {
    setNewTransfer((p) => {
      const emp = employees.find((e: any) => e.id === employeeId)
      const fromWsId = emp?.employment?.worksiteId || ''
      return { ...p, employeeId, fromWorksiteId: fromWsId }
    })
  }

  const { data: worksitesData } = useQuery({
    queryKey: ['worksites-list'],
    queryFn: async () => {
      const res = await apiClient.get('/worksites?limit=200&status=ACTIVE')
      return res.data
    },
  })

  const createMutation = useMutation({
    mutationFn: (payload: typeof newTransfer) => apiClient.post('/transfers', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] })
      setShowAdd(false)
      setNewTransfer({
        employeeId: '',
        fromWorksiteId: '',
        toWorksiteId: '',
        transferDate: '',
        transferType: 'PERMANENT',
        reason: '',
        accommodationEffect: '',
        salaryEffect: '',
        notes: '',
      })
      setFormError('')
    },
    onError: (err: any) => {
      const code = err.response?.data?.error || ''
      const errorMap: Record<string, string> = {
        'UNAUTHORIZED': t('common.unauthorized'),
        'FIELDS_REQUIRED': t('common.fieldsRequired'),
        'EMPLOYEE_NOT_FOUND': t('common.employeeNotFound'),
        'WORKSITE_NOT_FOUND': t('common.worksiteNotFound'),
        'CREATE_FAILED': t('common.createFailed'),
      }
      setFormError(errorMap[code] || t('common.createFailed'))
    },
  })

  const approveMutation = useMutation({
    mutationFn: (id: string) => apiClient.put(`/transfers/${id}`, { status: 'APPROVED' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['transfers'] }),
  })

  const handleSearch = useCallback(() => {
    setSearch(searchInput)
    setPage(1)
  }, [searchInput])

  const employees = employeesData?.data || []
  const worksites = worksitesData?.data || []

  const statusBadge = (status: string) => {
    const variants: Record<string, 'warning' | 'success' | 'destructive' | 'secondary' | 'default'> = {
      PENDING: 'warning',
      APPROVED: 'success',
      COMPLETED: 'success',
      REJECTED: 'destructive',
      CANCELLED: 'secondary',
    }
    return (
      <Badge variant={variants[status] || 'secondary'}>
        {t(`common.${status.toLowerCase()}`) || status}
      </Badge>
    )
  }

  const columns: Column<TransferRow>[] = [
    {
      key: 'employee',
      header: t('employee.title'),
      render: (item) => (
        <div>
          <span className="font-medium">
            {item.employee.firstName} {item.employee.lastName}
          </span>
          <span className="text-xs text-muted-foreground ml-1">
            ({item.employee.employeeNo})
          </span>
        </div>
      ),
    },
    {
      key: 'route',
      header: `${t('transfer.from')} / ${t('transfer.to')}`,
      render: (item) => (
        <div className="flex items-center gap-2">
          <span className="text-sm">{item.fromWorksite.name}</span>
          <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium">{item.toWorksite.name}</span>
        </div>
      ),
    },
    {
      key: 'transferDate',
      header: t('transfer.transferDate'),
      render: (item) => new Date(item.transferDate).toLocaleDateString(),
    },
    {
      key: 'transferType',
      header: t('transfer.transferType'),
      render: (item) => (
        <Badge variant="outline">
          {t(`transfer.${item.transferType.toLowerCase()}`) || item.transferType}
        </Badge>
      ),
    },
    {
      key: 'reason',
      header: t('transfer.reason'),
      render: (item) => (
        <span className="text-sm text-muted-foreground truncate max-w-[150px] block">
          {item.reason || '-'}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (item) => statusBadge(item.status),
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (item) => {
        if (item.status !== 'PENDING') return null
        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              approveMutation.mutate(item.id)
            }}
          >
            <CheckCircle className="h-4 w-4 mr-1 text-success" />
            {t('common.approve')}
          </Button>
        )
      },
    },
  ]

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">{t('transfer.title')}</h1>
            <HelpTooltip helpKey="transfer" />
          </div>
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-1" />
            {t('transfer.addNew')}
          </Button>
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
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value)
                  setPage(1)
                }}
              >
                <option value="">{t('common.all')} {t('common.status')}</option>
                <option value="PENDING">{t('common.pending')}</option>
                <option value="APPROVED">{t('common.approved')}</option>
                <option value="COMPLETED">{t('common.completed')}</option>
                <option value="REJECTED">{t('common.rejected')}</option>
              </select>
              {data?.pagination && (
                <div className="ml-auto text-sm text-muted-foreground">
                  {t('common.total')}: <span className="font-medium">{data.pagination.total}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Add Transfer Form */}
        {showAdd && (
          <Card className="border-primary/30">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{t('transfer.addNew')}</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => { setShowAdd(false); setFormError('') }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {formError && (
                <div className="mb-3 rounded-md bg-destructive/10 p-2 text-sm text-destructive">{formError}</div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {t('employee.title')} <span className="text-destructive">*</span>
                  </label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                    value={newTransfer.employeeId}
                    onChange={(e) => handleEmployeeChange(e.target.value)}
                  >
                    <option value="">--</option>
                    {employees.map((emp: any) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.employeeNo} - {emp.firstName} {emp.lastName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {t('transfer.from')} ({t('employee.currentWorksite')})
                  </label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm bg-muted"
                    value={newTransfer.fromWorksiteId}
                    disabled
                  >
                    <option value="">--</option>
                    {worksites.map((ws: any) => (
                      <option key={ws.id} value={ws.id}>{ws.code} - {ws.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {t('transfer.to')} <span className="text-destructive">*</span>
                  </label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                    value={newTransfer.toWorksiteId}
                    onChange={(e) => setNewTransfer((p) => ({ ...p, toWorksiteId: e.target.value }))}
                  >
                    <option value="">--</option>
                    {worksites.map((ws: any) => (
                      <option key={ws.id} value={ws.id}>{ws.code} - {ws.name}</option>
                    ))}
                  </select>
                </div>
                <Input
                  label={t('transfer.transferDate')}
                  type="date"
                  value={newTransfer.transferDate}
                  onChange={(e) => setNewTransfer((p) => ({ ...p, transferDate: e.target.value }))}
                  required
                />
                <div>
                  <label className="block text-sm font-medium mb-1">{t('transfer.transferType')}</label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                    value={newTransfer.transferType}
                    onChange={(e) => setNewTransfer((p) => ({ ...p, transferType: e.target.value }))}
                  >
                    <option value="PERMANENT">{t('transfer.permanent')}</option>
                    <option value="TEMPORARY">{t('transfer.temporary')}</option>
                  </select>
                </div>
                <Input
                  label={t('transfer.reason')}
                  value={newTransfer.reason}
                  onChange={(e) => setNewTransfer((p) => ({ ...p, reason: e.target.value }))}
                />
                <Input
                  label={t('transfer.accommodationEffect')}
                  value={newTransfer.accommodationEffect}
                  onChange={(e) => setNewTransfer((p) => ({ ...p, accommodationEffect: e.target.value }))}
                />
                <Input
                  label={t('transfer.salaryEffect')}
                  value={newTransfer.salaryEffect}
                  onChange={(e) => setNewTransfer((p) => ({ ...p, salaryEffect: e.target.value }))}
                />
              </div>
              <div className="flex items-center gap-2 mt-3">
                <Button onClick={() => createMutation.mutate(newTransfer)} loading={createMutation.isPending}>
                  <Check className="h-4 w-4 mr-1" />
                  {t('common.save')}
                </Button>
                <Button variant="outline" onClick={() => { setShowAdd(false); setFormError('') }}>
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
          onRowClick={(item) => router.push(`/${locale}/employees/${item.employee.id}`)}
          emptyMessage={t('common.noData')}
        />
      </div>
    </AppLayout>
  )
}
