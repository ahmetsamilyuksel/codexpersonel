'use client'

import React, { useState, useCallback, useRef } from 'react'
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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus,
  Search,
  Download,
  Upload,
  Users,
  X,
  Check,
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
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [sortKey, setSortKey] = useState('employeeNo')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [statusFilter, setStatusFilter] = useState('ACTIVE')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [formError, setFormError] = useState('')
  const [importStatus, setImportStatus] = useState('')
  const [newEmployee, setNewEmployee] = useState({
    firstName: '',
    lastName: '',
    patronymic: '',
    phone: '',
    nationalityId: '',
    professionId: '',
    departmentId: '',
    worksiteId: '',
    gender: 'MALE',
  })
  const limit = 25

  const { data, isLoading } = useQuery({
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

  const { data: nationalitiesData } = useQuery({
    queryKey: ['nationalities-list'],
    queryFn: async () => {
      const res = await apiClient.get('/nationalities?limit=200')
      return res.data
    },
    enabled: showAdd,
  })

  const { data: professionsData } = useQuery({
    queryKey: ['professions-list'],
    queryFn: async () => {
      const res = await apiClient.get('/professions?limit=200')
      return res.data
    },
    enabled: showAdd,
  })

  const { data: departmentsData } = useQuery({
    queryKey: ['departments-list'],
    queryFn: async () => {
      const res = await apiClient.get('/departments?limit=200')
      return res.data
    },
    enabled: showAdd,
  })

  const { data: worksitesData } = useQuery({
    queryKey: ['worksites-list-emp'],
    queryFn: async () => {
      const res = await apiClient.get('/worksites?limit=200&status=ACTIVE')
      return res.data
    },
    enabled: showAdd,
  })

  const createMutation = useMutation({
    mutationFn: (payload: typeof newEmployee) => apiClient.post('/employees', payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      setShowAdd(false)
      setNewEmployee({ firstName: '', lastName: '', patronymic: '', phone: '', nationalityId: '', professionId: '', departmentId: '', worksiteId: '', gender: 'MALE' })
      setFormError('')
      if (res.data?.data?.id) {
        router.push(`/${locale}/employees/${res.data.data.id}`)
      }
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.error || t('common.createFailed'))
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
      const res = await apiClient.post('/reports/export', {
        reportType: 'EMPLOYEE_LIST',
        filters: statusFilter ? { status: statusFilter } : {},
      }, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `employees_${new Date().toISOString().slice(0, 10)}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch {
      // If report API doesn't exist, try simple JSON export
      try {
        const res = await apiClient.get('/employees?limit=10000')
        const jsonStr = JSON.stringify(res.data?.data || [], null, 2)
        const blob = new Blob([jsonStr], { type: 'application/json' })
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', `employees_${new Date().toISOString().slice(0, 10)}.json`)
        document.body.appendChild(link)
        link.click()
        link.remove()
      } catch {
        // silently fail
      }
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportStatus(t('common.loading'))
    try {
      const formData = new FormData()
      formData.append('file', file)
      await apiClient.post('/employees/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setImportStatus('')
      queryClient.invalidateQueries({ queryKey: ['employees'] })
    } catch {
      setImportStatus(t('common.createFailed'))
      setTimeout(() => setImportStatus(''), 3000)
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const nationalities = nationalitiesData?.data || []
  const professions = professionsData?.data || []
  const departments = departmentsData?.data || []
  const worksites = worksitesData?.data || []

  const statusBadge = (status: string) => {
    const variants: Record<string, 'success' | 'secondary' | 'destructive' | 'warning'> = {
      ACTIVE: 'success',
      INACTIVE: 'secondary',
      TERMINATED: 'destructive',
      ON_LEAVE: 'warning',
    }
    const tKey = status === 'ON_LEAVE' ? 'common.onLeave' : `common.${status.toLowerCase()}`
    return <Badge variant={variants[status] || 'secondary'}>{t(tKey)}</Badge>
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
        {/* Hidden file input for import */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".xlsx,.xls,.csv"
          onChange={handleImport}
        />

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
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-1" />
              {t('common.import')}
            </Button>
            <Button onClick={() => setShowAdd(true)}>
              <Plus className="h-4 w-4 mr-1" />
              {t('employee.addNew')}
            </Button>
          </div>
        </div>

        {importStatus && (
          <div className="rounded-md bg-primary/10 p-2 text-sm text-primary">{importStatus}</div>
        )}

        {/* Add Employee Inline Form */}
        {showAdd && (
          <Card className="border-primary/30">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{t('employee.addNew')}</CardTitle>
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
                  label={t('employee.firstName')}
                  value={newEmployee.firstName}
                  onChange={(e) => setNewEmployee((p) => ({ ...p, firstName: e.target.value }))}
                  required
                />
                <Input
                  label={t('employee.lastName')}
                  value={newEmployee.lastName}
                  onChange={(e) => setNewEmployee((p) => ({ ...p, lastName: e.target.value }))}
                  required
                />
                <Input
                  label={t('employee.patronymic')}
                  value={newEmployee.patronymic}
                  onChange={(e) => setNewEmployee((p) => ({ ...p, patronymic: e.target.value }))}
                />
                <Input
                  label={t('employee.phone')}
                  value={newEmployee.phone}
                  onChange={(e) => setNewEmployee((p) => ({ ...p, phone: e.target.value }))}
                />
                <div>
                  <label className="block text-sm font-medium mb-1">{t('employee.gender')}</label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                    value={newEmployee.gender}
                    onChange={(e) => setNewEmployee((p) => ({ ...p, gender: e.target.value }))}
                  >
                    <option value="MALE">{t('employee.male')}</option>
                    <option value="FEMALE">{t('employee.female')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('employee.nationality')}</label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                    value={newEmployee.nationalityId}
                    onChange={(e) => setNewEmployee((p) => ({ ...p, nationalityId: e.target.value }))}
                  >
                    <option value="">--</option>
                    {nationalities.map((n: any) => (
                      <option key={n.id} value={n.id}>{getLocalizedName(n, localeStore.locale)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('employee.profession')}</label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                    value={newEmployee.professionId}
                    onChange={(e) => setNewEmployee((p) => ({ ...p, professionId: e.target.value }))}
                  >
                    <option value="">--</option>
                    {professions.map((p: any) => (
                      <option key={p.id} value={p.id}>{getLocalizedName(p, localeStore.locale)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('employment.worksite')}</label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                    value={newEmployee.worksiteId}
                    onChange={(e) => setNewEmployee((p) => ({ ...p, worksiteId: e.target.value }))}
                  >
                    <option value="">--</option>
                    {worksites.map((ws: any) => (
                      <option key={ws.id} value={ws.id}>{ws.code} - {ws.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <Button
                  onClick={() => createMutation.mutate(newEmployee)}
                  loading={createMutation.isPending}
                  disabled={!newEmployee.firstName || !newEmployee.lastName}
                >
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
                  <option value="TERMINATED">{t('common.terminated')}</option>
                  <option value="ON_LEAVE">{t('common.onLeave')}</option>
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
