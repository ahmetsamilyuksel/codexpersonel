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
  Package,
  Plus,
  Search,
  Download,
  UserPlus,
  RotateCcw,
  X,
  Check,
} from 'lucide-react'

interface AssetRow {
  id: string
  assetNo: string
  name: string
  brand: string | null
  model: string | null
  serialNo: string | null
  status: string
  purchasePrice: string | null
  depositAmount: string | null
  category: { id: string; nameTr: string; nameRu: string; nameEn: string }
  worksite: { id: string; name: string; code: string } | null
  assignments: {
    id: string
    employeeId: string
    assignedDate: string
    returnDate: string | null
    employee: { id: string; firstName: string; lastName: string; employeeNo: string }
  }[]
}

export default function AssetsPage() {
  const { t, locale } = useTranslations()
  const { locale: currentLocale } = useLocaleStore()
  const router = useRouter()
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [worksiteFilter, setWorksiteFilter] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [showAssign, setShowAssign] = useState<string | null>(null)
  const [assignForm, setAssignForm] = useState({ employeeId: '', notes: '' })
  const [newAsset, setNewAsset] = useState({
    name: '',
    categoryId: '',
    brand: '',
    model: '',
    serialNo: '',
    worksiteId: '',
    purchasePrice: '',
    depositAmount: '',
    notes: '',
  })
  const [formError, setFormError] = useState('')
  const limit = 25

  const { data, isLoading } = useQuery({
    queryKey: ['assets', page, search, statusFilter, categoryFilter, worksiteFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      })
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)
      if (categoryFilter) params.set('categoryId', categoryFilter)
      if (worksiteFilter) params.set('worksiteId', worksiteFilter)
      const res = await apiClient.get(`/assets?${params}`)
      return res.data
    },
  })

  const { data: categoriesData } = useQuery({
    queryKey: ['asset-categories-list'],
    queryFn: async () => {
      const res = await apiClient.get('/asset-categories?limit=100')
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

  const { data: employeesData } = useQuery({
    queryKey: ['employees-for-assign'],
    queryFn: async () => {
      const res = await apiClient.get('/employees?limit=500&status=ACTIVE')
      return res.data
    },
    enabled: !!showAssign,
  })

  const createMutation = useMutation({
    mutationFn: (payload: typeof newAsset) => apiClient.post('/assets', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      setShowAdd(false)
      setNewAsset({ name: '', categoryId: '', brand: '', model: '', serialNo: '', worksiteId: '', purchasePrice: '', depositAmount: '', notes: '' })
      setFormError('')
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.error || t('common.createFailed'))
    },
  })

  const assignMutation = useMutation({
    mutationFn: ({ assetId, employeeId, notes }: { assetId: string; employeeId: string; notes: string }) =>
      apiClient.post(`/assets/${assetId}/assign`, {
        employeeId,
        assignedDate: new Date().toISOString(),
        notes,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      setShowAssign(null)
      setAssignForm({ employeeId: '', notes: '' })
    },
  })

  const returnMutation = useMutation({
    mutationFn: ({ assetId, assignmentId }: { assetId: string; assignmentId: string }) =>
      apiClient.post(`/assets/${assetId}/return`, {
        assignmentId,
        returnDate: new Date().toISOString(),
        returnStatus: 'GOOD',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] })
    },
  })

  const handleSearch = useCallback(() => {
    setSearch(searchInput)
    setPage(1)
  }, [searchInput])

  const categories = categoriesData?.data || []
  const worksites = worksitesData?.data || []
  const employees = employeesData?.data || []

  const getCurrentAssignee = (asset: AssetRow) => {
    const active = asset.assignments?.find((a) => !a.returnDate)
    return active?.employee || null
  }

  const statusBadge = (status: string) => {
    const variants: Record<string, 'success' | 'default' | 'warning' | 'destructive' | 'secondary'> = {
      AVAILABLE: 'success',
      ASSIGNED: 'default',
      DAMAGED: 'warning',
      LOST: 'destructive',
      DISPOSED: 'secondary',
    }
    return (
      <Badge variant={variants[status] || 'secondary'}>
        {t(`asset.${status.toLowerCase()}`) || status}
      </Badge>
    )
  }

  const columns: Column<AssetRow>[] = [
    {
      key: 'assetNo',
      header: t('asset.assetNo'),
      sortable: true,
      render: (item) => <span className="font-mono text-xs font-medium">{item.assetNo}</span>,
    },
    {
      key: 'name',
      header: t('common.name'),
      render: (item) => (
        <div>
          <span className="font-medium">{item.name}</span>
          {item.brand && (
            <span className="text-xs text-muted-foreground ml-1">
              ({item.brand} {item.model || ''})
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'category',
      header: t('asset.category'),
      render: (item) => getLocalizedName(item.category, currentLocale),
    },
    {
      key: 'worksite',
      header: t('employment.worksite'),
      render: (item) => item.worksite?.name || '-',
    },
    {
      key: 'assignee',
      header: t('common.assignee'),
      render: (item) => {
        const assignee = getCurrentAssignee(item)
        return assignee ? (
          <span className="text-sm">
            {assignee.firstName} {assignee.lastName}
          </span>
        ) : (
          <span className="text-muted-foreground">-</span>
        )
      },
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
        const activeAssignment = item.assignments?.find((a) => !a.returnDate)
        return (
          <div className="flex items-center gap-1">
            {item.status === 'AVAILABLE' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowAssign(item.id)
                }}
              >
                <UserPlus className="h-3 w-3 mr-1" />
                {t('asset.assign')}
              </Button>
            )}
            {activeAssignment && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  returnMutation.mutate({
                    assetId: item.id,
                    assignmentId: activeAssignment.id,
                  })
                }}
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                {t('asset.return')}
              </Button>
            )}
          </div>
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
            <Package className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">{t('asset.title')}</h1>
            <HelpTooltip helpKey="asset" />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-1" />
              {t('common.export')}
            </Button>
            <Button onClick={() => setShowAdd(true)}>
              <Plus className="h-4 w-4 mr-1" />
              {t('asset.addNew')}
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
                <option value="">{t('common.all')} {t('common.status')}</option>
                <option value="AVAILABLE">{t('asset.available')}</option>
                <option value="ASSIGNED">{t('asset.assigned')}</option>
                <option value="DAMAGED">{t('asset.damaged')}</option>
                <option value="LOST">{t('asset.lost')}</option>
              </select>
              <select
                className="h-9 rounded-md border border-input bg-card px-3 text-sm"
                value={categoryFilter}
                onChange={(e) => { setCategoryFilter(e.target.value); setPage(1) }}
              >
                <option value="">{t('common.all')} {t('asset.category')}</option>
                {categories.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {getLocalizedName(c, currentLocale)}
                  </option>
                ))}
              </select>
              <select
                className="h-9 rounded-md border border-input bg-card px-3 text-sm"
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
              {data?.pagination && (
                <div className="ml-auto text-sm text-muted-foreground">
                  {t('common.total')}: <span className="font-medium">{data.pagination.total}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Add Asset Form */}
        {showAdd && (
          <Card className="border-primary/30">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{t('asset.addNew')}</CardTitle>
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
                <Input
                  label={t('common.name')}
                  value={newAsset.name}
                  onChange={(e) => setNewAsset((p) => ({ ...p, name: e.target.value }))}
                  required
                />
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {t('asset.category')} <span className="text-destructive">*</span>
                  </label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                    value={newAsset.categoryId}
                    onChange={(e) => setNewAsset((p) => ({ ...p, categoryId: e.target.value }))}
                  >
                    <option value="">--</option>
                    {categories.map((c: any) => (
                      <option key={c.id} value={c.id}>{getLocalizedName(c, currentLocale)}</option>
                    ))}
                  </select>
                </div>
                <Input label={t('asset.brand')} value={newAsset.brand} onChange={(e) => setNewAsset((p) => ({ ...p, brand: e.target.value }))} />
                <Input label={t('asset.model')} value={newAsset.model} onChange={(e) => setNewAsset((p) => ({ ...p, model: e.target.value }))} />
                <Input label={t('asset.serialNo')} value={newAsset.serialNo} onChange={(e) => setNewAsset((p) => ({ ...p, serialNo: e.target.value }))} />
                <div>
                  <label className="block text-sm font-medium mb-1">{t('employment.worksite')}</label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                    value={newAsset.worksiteId}
                    onChange={(e) => setNewAsset((p) => ({ ...p, worksiteId: e.target.value }))}
                  >
                    <option value="">--</option>
                    {worksites.map((ws: any) => (
                      <option key={ws.id} value={ws.id}>{ws.code} - {ws.name}</option>
                    ))}
                  </select>
                </div>
                <Input label={t('common.purchasePrice')} type="number" value={newAsset.purchasePrice} onChange={(e) => setNewAsset((p) => ({ ...p, purchasePrice: e.target.value }))} />
                <Input label={t('common.depositAmount')} type="number" value={newAsset.depositAmount} onChange={(e) => setNewAsset((p) => ({ ...p, depositAmount: e.target.value }))} />
              </div>
              <div className="flex items-center gap-2 mt-3">
                <Button onClick={() => createMutation.mutate(newAsset)} loading={createMutation.isPending}>
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

        {/* Assign Modal */}
        {showAssign && (
          <Card className="border-primary/30">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{t('asset.assign')}</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setShowAssign(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">{t('employee.title')}</label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                    value={assignForm.employeeId}
                    onChange={(e) => setAssignForm((p) => ({ ...p, employeeId: e.target.value }))}
                  >
                    <option value="">--</option>
                    {employees.map((emp: any) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.employeeNo} - {emp.firstName} {emp.lastName}
                      </option>
                    ))}
                  </select>
                </div>
                <Input
                  label={t('common.notes')}
                  value={assignForm.notes}
                  onChange={(e) => setAssignForm((p) => ({ ...p, notes: e.target.value }))}
                />
              </div>
              <div className="flex items-center gap-2 mt-3">
                <Button
                  onClick={() =>
                    assignMutation.mutate({
                      assetId: showAssign,
                      employeeId: assignForm.employeeId,
                      notes: assignForm.notes,
                    })
                  }
                  loading={assignMutation.isPending}
                  disabled={!assignForm.employeeId}
                >
                  <Check className="h-4 w-4 mr-1" />
                  {t('asset.assign')}
                </Button>
                <Button variant="outline" onClick={() => setShowAssign(null)}>
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
          emptyMessage={t('common.noData')}
        />
      </div>
    </AppLayout>
  )
}
