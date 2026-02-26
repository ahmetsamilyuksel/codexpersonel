'use client'

import React, { useState, useCallback, useEffect } from 'react'
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
import apiClient from '@/lib/api-client'
import { useQuery } from '@tanstack/react-query'
import {
  Plus,
  Search,
  Download,
  Upload,
  Filter,
  Users,
} from 'lucide-react'

interface EmployeeRow {
  id: string
  employeeNo: string
  firstName: string
  lastName: string
  phone: string | null
  status: string
  nationality: { nameTr: string; nameRu: string; nameEn: string } | null
  profession: { nameTr: string; nameRu: string; nameEn: string } | null
  department: { nameTr: string; nameRu: string; nameEn: string } | null
  employment: { worksite: { name: string } | null } | null
  workStatus: { workStatusType: string } | null
  photoUrl: string | null
}

export default function EmployeesPage() {
  const { t, locale } = useTranslations()
  const localeStore = useLocaleStore()
  const router = useRouter()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [sortKey, setSortKey] = useState('employeeNo')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [statusFilter, setStatusFilter] = useState('ACTIVE')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const limit = 25

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['employees', page, search, sortKey, sortOrder, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        sort: sortKey,
        order: sortOrder,
      })
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)
      const res = await apiClient.get(`/employees?${params}`)
      return res.data
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

  const handleExport = async () => {
    try {
      const res = await apiClient.get('/employees?limit=10000&format=excel', { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `employees_${new Date().toISOString().slice(0, 10)}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch {
      // handle error
    }
  }

  const statusBadge = (status: string) => {
    const variants: Record<string, 'success' | 'secondary' | 'destructive' | 'warning'> = {
      ACTIVE: 'success',
      INACTIVE: 'secondary',
      TERMINATED: 'destructive',
      ON_LEAVE: 'warning',
    }
    return <Badge variant={variants[status] || 'secondary'}>{t(`common.${status.toLowerCase()}`) || status}</Badge>
  }

  const workStatusBadge = (type: string | undefined) => {
    if (!type) return null
    const colors: Record<string, string> = {
      LOCAL: 'bg-blue-100 text-blue-800',
      PATENT: 'bg-amber-100 text-amber-800',
      VISA: 'bg-purple-100 text-purple-800',
      WORK_PERMIT: 'bg-green-100 text-green-800',
      RESIDENCE_PERMIT: 'bg-cyan-100 text-cyan-800',
      OTHER: 'bg-gray-100 text-gray-800',
    }
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[type] || colors.OTHER}`}>
        {t(`workStatus.${type.toLowerCase().replace('_', '')}`)}
      </span>
    )
  }

  const columns: Column<EmployeeRow>[] = [
    {
      key: 'employeeNo',
      header: t('employee.employeeNo'),
      sortable: true,
      render: (item) => <span className="font-mono text-xs font-medium">{item.employeeNo}</span>,
    },
    {
      key: 'fullName',
      header: `${t('employee.firstName')} ${t('employee.lastName')}`,
      sortable: true,
      render: (item) => (
        <div className="flex items-center gap-2">
          {item.photoUrl ? (
            <img src={item.photoUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
              {item.firstName[0]}{item.lastName[0]}
            </div>
          )}
          <div>
            <span className="font-medium">{item.firstName} {item.lastName}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'nationality',
      header: t('employee.nationality'),
      render: (item) => getLocalizedName(item.nationality, localeStore.locale),
    },
    {
      key: 'profession',
      header: t('employee.profession'),
      render: (item) => getLocalizedName(item.profession, localeStore.locale),
    },
    {
      key: 'department',
      header: t('employee.department'),
      render: (item) => getLocalizedName(item.department, localeStore.locale),
    },
    {
      key: 'worksite',
      header: t('employment.worksite'),
      render: (item) => item.employment?.worksite?.name || '-',
    },
    {
      key: 'workStatusType',
      header: t('workStatus.title'),
      render: (item) => workStatusBadge(item.workStatus?.workStatusType),
    },
    {
      key: 'phone',
      header: t('employee.phone'),
      render: (item) => item.phone || '-',
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
            <Users className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">{t('employee.title')}</h1>
            <HelpTooltip helpKey="employeeNo" />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-1" />
              {t('common.export')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => router.push(`/${locale}/employees/import`)}>
              <Upload className="h-4 w-4 mr-1" />
              {t('common.import')}
            </Button>
            <Button onClick={() => router.push(`/${locale}/employees/new`)}>
              <Plus className="h-4 w-4 mr-1" />
              {t('employee.addNew')}
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
              <div className="flex items-center gap-2">
                <select
                  className="h-9 rounded-md border border-input bg-card px-3 text-sm"
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
                >
                  <option value="">{t('common.all')}</option>
                  <option value="ACTIVE">{t('common.active')}</option>
                  <option value="INACTIVE">{t('common.inactive')}</option>
                  <option value="TERMINATED">{t('common.completed')}</option>
                  <option value="ON_LEAVE">{t('attendance.onLeave')}</option>
                </select>
              </div>
              {data?.pagination && (
                <div className="ml-auto text-sm text-muted-foreground">
                  {t('common.total')}: <span className="font-medium">{data.pagination.total}</span>
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
          onSort={handleSort}
          sortKey={sortKey}
          sortOrder={sortOrder}
          loading={isLoading}
          onRowClick={(item) => router.push(`/${locale}/employees/${item.id}`)}
          selectedIds={selectedIds}
          onSelect={setSelectedIds}
          emptyMessage={t('common.noData')}
        />
      </div>
    </AppLayout>
  )
}
