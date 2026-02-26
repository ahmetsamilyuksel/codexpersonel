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
import { useLocaleStore, getLocalizedName } from '@/store/locale-store'
import { useAuthStore } from '@/store/auth-store'
import apiClient from '@/lib/api-client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CalendarOff,
  Plus,
  Search,
  CheckCircle,
  XCircle,
  X,
  Check,
} from 'lucide-react'

interface LeaveRequestRow {
  id: string
  startDate: string
  endDate: string
  totalDays: string
  reason: string | null
  status: string
  createdAt: string
  employee: {
    id: string
    employeeNo: string
    firstName: string
    lastName: string
  }
  leaveType: {
    id: string
    code: string
    nameTr: string
    nameRu: string
    nameEn: string
  }
}

interface LeaveBalanceRow {
  id: string
  year: number
  entitled: string
  used: string
  remaining: string
  employee: {
    id: string
    firstName: string
    lastName: string
    employeeNo: string
  }
  leaveType: {
    id: string
    nameTr: string
    nameRu: string
    nameEn: string
  }
}

export default function LeavesPage() {
  const { t, locale } = useTranslations()
  const { locale: currentLocale } = useLocaleStore()
  const { hasPermission } = useAuthStore()
  const router = useRouter()
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [showBalances, setShowBalances] = useState(false)
  const [newLeave, setNewLeave] = useState({
    employeeId: '',
    leaveTypeId: '',
    startDate: '',
    endDate: '',
    reason: '',
  })
  const [formError, setFormError] = useState('')
  const limit = 25

  const { data, isLoading } = useQuery({
    queryKey: ['leave-requests', page, search, statusFilter, typeFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        sort: 'createdAt',
        order: 'desc',
      })
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)
      if (typeFilter) params.set('leaveTypeId', typeFilter)
      const res = await apiClient.get(`/leave-requests?${params}`)
      return res.data
    },
  })

  const { data: leaveTypesData } = useQuery({
    queryKey: ['leave-types-list'],
    queryFn: async () => {
      const res = await apiClient.get('/leave-types?limit=100')
      return res.data
    },
  })

  const { data: employeesData } = useQuery({
    queryKey: ['employees-for-leave'],
    queryFn: async () => {
      const res = await apiClient.get('/employees?limit=500&status=ACTIVE')
      return res.data
    },
    enabled: showAdd,
  })

  const { data: balancesData, isLoading: balancesLoading } = useQuery({
    queryKey: ['leave-balances'],
    queryFn: async () => {
      const res = await apiClient.get('/leave-balances?limit=200')
      return res.data
    },
    enabled: showBalances,
  })

  const createMutation = useMutation({
    mutationFn: (payload: typeof newLeave) => apiClient.post('/leave-requests', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] })
      setShowAdd(false)
      setNewLeave({ employeeId: '', leaveTypeId: '', startDate: '', endDate: '', reason: '' })
      setFormError('')
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.error || 'Failed to create leave request')
    },
  })

  const approveMutation = useMutation({
    mutationFn: (id: string) => apiClient.put(`/leave-requests/${id}`, { status: 'APPROVED' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leave-requests'] }),
  })

  const rejectMutation = useMutation({
    mutationFn: (id: string) => apiClient.put(`/leave-requests/${id}`, { status: 'REJECTED' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leave-requests'] }),
  })

  const handleSearch = useCallback(() => {
    setSearch(searchInput)
    setPage(1)
  }, [searchInput])

  const leaveTypes = leaveTypesData?.data || []
  const employees = employeesData?.data || []

  const statusBadge = (status: string) => {
    const variants: Record<string, 'warning' | 'success' | 'destructive' | 'secondary'> = {
      PENDING: 'warning',
      APPROVED: 'success',
      REJECTED: 'destructive',
      CANCELLED: 'secondary',
    }
    return (
      <Badge variant={variants[status] || 'secondary'}>
        {t(`common.${status.toLowerCase()}`) || status}
      </Badge>
    )
  }

  const columns: Column<LeaveRequestRow>[] = [
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
      key: 'leaveType',
      header: t('leave.leaveType'),
      render: (item) => (
        <Badge variant="outline">{getLocalizedName(item.leaveType, currentLocale)}</Badge>
      ),
    },
    {
      key: 'startDate',
      header: t('leave.startDate'),
      render: (item) => new Date(item.startDate).toLocaleDateString(),
    },
    {
      key: 'endDate',
      header: t('leave.endDate'),
      render: (item) => new Date(item.endDate).toLocaleDateString(),
    },
    {
      key: 'totalDays',
      header: t('leave.totalDays'),
      render: (item) => (
        <span className="font-medium">{item.totalDays}</span>
      ),
    },
    {
      key: 'reason',
      header: t('leave.reason'),
      render: (item) => (
        <span className="text-sm text-muted-foreground truncate max-w-[200px] block">
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
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              title={t('common.approve')}
              onClick={(e) => {
                e.stopPropagation()
                approveMutation.mutate(item.id)
              }}
            >
              <CheckCircle className="h-4 w-4 text-success" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              title={t('common.reject')}
              onClick={(e) => {
                e.stopPropagation()
                rejectMutation.mutate(item.id)
              }}
            >
              <XCircle className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        )
      },
    },
  ]

  const balanceColumns: Column<LeaveBalanceRow>[] = [
    {
      key: 'employee',
      header: t('employee.title'),
      render: (item) => `${item.employee.firstName} ${item.employee.lastName}`,
    },
    {
      key: 'leaveType',
      header: t('leave.leaveType'),
      render: (item) => getLocalizedName(item.leaveType, currentLocale),
    },
    { key: 'year', header: 'Year' },
    {
      key: 'entitled',
      header: t('leave.entitled'),
      render: (item) => <span className="font-medium">{item.entitled}</span>,
    },
    {
      key: 'used',
      header: t('leave.used'),
      render: (item) => <span className="text-warning">{item.used}</span>,
    },
    {
      key: 'remaining',
      header: t('leave.remaining'),
      render: (item) => (
        <span className={`font-bold ${Number(item.remaining) <= 0 ? 'text-destructive' : 'text-success'}`}>
          {item.remaining}
        </span>
      ),
    },
  ]

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarOff className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">{t('leave.title')}</h1>
            <HelpTooltip helpKey="leave" />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={showBalances ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowBalances(!showBalances)}
            >
              {t('leave.balance')}
            </Button>
            <Button onClick={() => setShowAdd(true)}>
              <Plus className="h-4 w-4 mr-1" />
              {t('leave.addNew')}
            </Button>
          </div>
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
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
              >
                <option value="">{t('common.all')} Status</option>
                <option value="PENDING">{t('common.pending')}</option>
                <option value="APPROVED">{t('common.approved')}</option>
                <option value="REJECTED">{t('common.rejected')}</option>
              </select>
              <select
                className="h-9 rounded-md border border-input bg-card px-3 text-sm"
                value={typeFilter}
                onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }}
              >
                <option value="">{t('common.all')} Types</option>
                {leaveTypes.map((lt: any) => (
                  <option key={lt.id} value={lt.id}>
                    {getLocalizedName(lt, currentLocale)}
                  </option>
                ))}
              </select>
              {data?.pagination && (
                <div className="ml-auto text-sm text-muted-foreground">
                  {t('common.total')}: <span className="font-medium">{data.pagination.total}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Add Leave Form */}
        {showAdd && (
          <Card className="border-primary/30">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{t('leave.addNew')}</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => { setShowAdd(false); setFormError('') }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {formError && (
                <div className="mb-3 rounded-md bg-destructive/10 p-2 text-sm text-destructive">{formError}</div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {t('employee.title')} <span className="text-destructive">*</span>
                  </label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                    value={newLeave.employeeId}
                    onChange={(e) => setNewLeave((p) => ({ ...p, employeeId: e.target.value }))}
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
                    {t('leave.leaveType')} <span className="text-destructive">*</span>
                  </label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                    value={newLeave.leaveTypeId}
                    onChange={(e) => setNewLeave((p) => ({ ...p, leaveTypeId: e.target.value }))}
                  >
                    <option value="">--</option>
                    {leaveTypes.map((lt: any) => (
                      <option key={lt.id} value={lt.id}>
                        {getLocalizedName(lt, currentLocale)}
                      </option>
                    ))}
                  </select>
                </div>
                <Input
                  label={t('leave.startDate')}
                  type="date"
                  value={newLeave.startDate}
                  onChange={(e) => setNewLeave((p) => ({ ...p, startDate: e.target.value }))}
                  required
                />
                <Input
                  label={t('leave.endDate')}
                  type="date"
                  value={newLeave.endDate}
                  onChange={(e) => setNewLeave((p) => ({ ...p, endDate: e.target.value }))}
                  required
                />
                <Input
                  label={t('leave.reason')}
                  value={newLeave.reason}
                  onChange={(e) => setNewLeave((p) => ({ ...p, reason: e.target.value }))}
                />
              </div>
              <div className="flex items-center gap-2 mt-3">
                <Button onClick={() => createMutation.mutate(newLeave)} loading={createMutation.isPending}>
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

        {/* Balances */}
        {showBalances && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('leave.balance')}</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={balanceColumns}
                data={balancesData?.data || []}
                loading={balancesLoading}
                emptyMessage={t('common.noData')}
              />
            </CardContent>
          </Card>
        )}

        {/* Requests Table */}
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
