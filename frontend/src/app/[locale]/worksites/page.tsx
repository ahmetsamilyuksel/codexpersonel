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
  Plus,
  Search,
  Building2,
  Download,
  X,
  Check,
} from 'lucide-react'

interface WorksiteRow {
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
  }
}

export default function WorksitesPage() {
  const { t, locale } = useTranslations()
  const localeStore = useLocaleStore()
  const router = useRouter()
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [sortKey, setSortKey] = useState('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [statusFilter, setStatusFilter] = useState('ACTIVE')
  const [showAddModal, setShowAddModal] = useState(false)
  const [newWorksite, setNewWorksite] = useState({
    code: '',
    name: '',
    city: '',
    region: '',
    address: '',
    projectManager: '',
    siteManager: '',
    client: '',
    status: 'ACTIVE',
    notes: '',
  })
  const [formError, setFormError] = useState('')
  const limit = 25

  const { data, isLoading } = useQuery({
    queryKey: ['worksites', page, search, sortKey, sortOrder, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      })
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)
      const res = await apiClient.get(`/worksites?${params}`)
      return res.data
    },
  })

  const createMutation = useMutation({
    mutationFn: (payload: typeof newWorksite) => apiClient.post('/worksites', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worksites'] })
      setShowAddModal(false)
      setNewWorksite({
        code: '',
        name: '',
        city: '',
        region: '',
        address: '',
        projectManager: '',
        siteManager: '',
        client: '',
        status: 'ACTIVE',
        notes: '',
      })
      setFormError('')
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.error || 'Failed to create worksite')
    },
  })

  const handleSearch = useCallback(() => {
    setSearch(searchInput)
    setPage(1)
  }, [searchInput])

  const handleSort = useCallback((key: string, order: 'asc' | 'desc') => {
    setSortKey(key)
    setSortOrder(order)
    setPage(1)
  }, [])

  const handleCreate = () => {
    if (!newWorksite.code || !newWorksite.name) {
      setFormError('Code and Name are required')
      return
    }
    createMutation.mutate(newWorksite)
  }

  const statusBadge = (status: string) => {
    const variants: Record<string, 'success' | 'secondary' | 'destructive' | 'warning'> = {
      ACTIVE: 'success',
      COMPLETED: 'secondary',
      SUSPENDED: 'warning',
      CANCELLED: 'destructive',
    }
    return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>
  }

  const columns: Column<WorksiteRow>[] = [
    {
      key: 'code',
      header: t('worksite.code'),
      sortable: true,
      render: (item) => <span className="font-mono text-xs font-medium">{item.code}</span>,
    },
    {
      key: 'name',
      header: t('worksite.name'),
      sortable: true,
      render: (item) => <span className="font-medium">{item.name}</span>,
    },
    {
      key: 'city',
      header: t('worksite.city'),
      sortable: true,
      render: (item) => item.city || '-',
    },
    {
      key: 'region',
      header: t('worksite.region'),
      render: (item) => item.region || '-',
    },
    {
      key: 'projectManager',
      header: t('worksite.projectManager'),
      render: (item) => item.projectManager || '-',
    },
    {
      key: 'siteManager',
      header: t('worksite.siteManager'),
      render: (item) => item.siteManager || '-',
    },
    {
      key: 'employeeCount',
      header: t('worksite.employeeCount'),
      render: (item) => (
        <Badge variant="outline">{item._count?.employments || 0}</Badge>
      ),
    },
    {
      key: 'status',
      header: t('common.status'),
      sortable: true,
      render: (item) => statusBadge(item.status),
    },
  ]

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">{t('worksite.title')}</h1>
            <HelpTooltip helpKey="worksite" />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                window.open(`/api/worksites?limit=10000&format=excel`, '_blank')
              }}
            >
              <Download className="h-4 w-4 mr-1" />
              {t('common.export')}
            </Button>
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="h-4 w-4 mr-1" />
              {t('worksite.addNew')}
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
                onChange={(e) => {
                  setStatusFilter(e.target.value)
                  setPage(1)
                }}
              >
                <option value="">{t('common.all')}</option>
                <option value="ACTIVE">{t('common.active')}</option>
                <option value="COMPLETED">{t('common.completed')}</option>
                <option value="SUSPENDED">Suspended</option>
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

        {/* Add Modal */}
        {showAddModal && (
          <Card className="border-primary/30">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{t('worksite.addNew')}</CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setShowAddModal(false)
                    setFormError('')
                  }}
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
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                <Input
                  label={t('worksite.code')}
                  value={newWorksite.code}
                  onChange={(e) => setNewWorksite((prev) => ({ ...prev, code: e.target.value }))}
                  required
                />
                <Input
                  label={t('worksite.name')}
                  value={newWorksite.name}
                  onChange={(e) => setNewWorksite((prev) => ({ ...prev, name: e.target.value }))}
                  required
                />
                <Input
                  label={t('worksite.city')}
                  value={newWorksite.city}
                  onChange={(e) => setNewWorksite((prev) => ({ ...prev, city: e.target.value }))}
                />
                <Input
                  label={t('worksite.region')}
                  value={newWorksite.region}
                  onChange={(e) => setNewWorksite((prev) => ({ ...prev, region: e.target.value }))}
                />
                <Input
                  label={t('worksite.address')}
                  value={newWorksite.address}
                  onChange={(e) =>
                    setNewWorksite((prev) => ({ ...prev, address: e.target.value }))
                  }
                />
                <Input
                  label={t('worksite.projectManager')}
                  value={newWorksite.projectManager}
                  onChange={(e) =>
                    setNewWorksite((prev) => ({ ...prev, projectManager: e.target.value }))
                  }
                />
                <Input
                  label={t('worksite.siteManager')}
                  value={newWorksite.siteManager}
                  onChange={(e) =>
                    setNewWorksite((prev) => ({ ...prev, siteManager: e.target.value }))
                  }
                />
                <Input
                  label={t('worksite.client')}
                  value={newWorksite.client}
                  onChange={(e) =>
                    setNewWorksite((prev) => ({ ...prev, client: e.target.value }))
                  }
                />
              </div>
              <div className="mt-3">
                <Input
                  label={t('common.notes')}
                  value={newWorksite.notes}
                  onChange={(e) => setNewWorksite((prev) => ({ ...prev, notes: e.target.value }))}
                />
              </div>
              <div className="flex items-center gap-2 mt-3">
                <Button onClick={handleCreate} loading={createMutation.isPending}>
                  <Check className="h-4 w-4 mr-1" />
                  {t('common.save')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddModal(false)
                    setFormError('')
                  }}
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
          onSort={handleSort}
          sortKey={sortKey}
          sortOrder={sortOrder}
          loading={isLoading}
          onRowClick={(item) => router.push(`/${locale}/worksites/${item.id}`)}
          emptyMessage={t('common.noData')}
        />
      </div>
    </AppLayout>
  )
}
