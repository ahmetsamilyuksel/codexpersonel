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
import apiClient from '@/lib/api-client'
import { useQuery } from '@tanstack/react-query'
import {
  FileText,
  Search,
  Download,
  AlertTriangle,
  AlertCircle,
  ShieldCheck,
  Clock,
} from 'lucide-react'

interface DocumentRow {
  id: string
  documentNo: string | null
  issuedBy: string | null
  issueDate: string | null
  expiryDate: string | null
  isVerified: boolean
  createdAt: string
  employee: {
    id: string
    employeeNo: string
    firstName: string
    lastName: string
  }
  documentType: {
    id: string
    code: string
    nameTr: string
    nameRu: string
    nameEn: string
    category: string
    hasExpiry: boolean
    defaultAlertDays: number
  }
  files: { id: string }[]
}

function getDocStatus(doc: DocumentRow): { label: string; variant: 'success' | 'destructive' | 'warning' | 'secondary'; tKey: string } {
  if (!doc.documentType.hasExpiry || !doc.expiryDate) {
    return doc.isVerified
      ? { label: 'verified', variant: 'success', tKey: 'document.verified' }
      : { label: 'uploaded', variant: 'secondary', tKey: 'common.completed' }
  }
  const daysLeft = Math.ceil((new Date(doc.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (daysLeft < 0) return { label: 'expired', variant: 'destructive', tKey: 'document.expired' }
  if (daysLeft <= doc.documentType.defaultAlertDays) return { label: 'expiring', variant: 'warning', tKey: 'document.expiringSoon' }
  return { label: 'valid', variant: 'success', tKey: 'document.verified' }
}

export default function DocumentsPage() {
  const { t, locale } = useTranslations()
  const { locale: currentLocale } = useLocaleStore()
  const router = useRouter()

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const limit = 25

  const { data, isLoading } = useQuery({
    queryKey: ['documents', page, search, statusFilter, categoryFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        sort: 'createdAt',
        order: 'desc',
      })
      if (search) params.set('search', search)
      if (categoryFilter) params.set('category', categoryFilter)
      const res = await apiClient.get(`/documents?${params}`)
      return res.data
    },
  })

  const { data: statsData } = useQuery({
    queryKey: ['document-stats'],
    queryFn: async () => {
      const res = await apiClient.get('/documents?limit=5000')
      const docs: DocumentRow[] = res.data?.data || []
      let expired = 0
      let expiring = 0
      let verified = 0
      docs.forEach((doc) => {
        const st = getDocStatus(doc)
        if (st.label === 'expired') expired++
        else if (st.label === 'expiring') expiring++
        if (doc.isVerified) verified++
      })
      return { total: docs.length, expired, expiring, verified }
    },
  })

  const handleSearch = useCallback(() => {
    setSearch(searchInput)
    setPage(1)
  }, [searchInput])

  const allDocs: DocumentRow[] = data?.data || []

  const filteredDocs = statusFilter
    ? allDocs.filter((doc) => {
        const st = getDocStatus(doc)
        if (statusFilter === 'EXPIRED') return st.label === 'expired'
        if (statusFilter === 'EXPIRING') return st.label === 'expiring'
        if (statusFilter === 'VERIFIED') return doc.isVerified
        return true
      })
    : allDocs

  const columns: Column<DocumentRow>[] = [
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
      key: 'documentType',
      header: t('document.documentType'),
      render: (item) => (
        <div>
          <span className="text-sm">{getLocalizedName(item.documentType, currentLocale)}</span>
          <Badge variant="outline" className="ml-2 text-xs">
            {item.documentType.category}
          </Badge>
        </div>
      ),
    },
    {
      key: 'documentNo',
      header: t('document.documentNo'),
      render: (item) => (
        <span className="font-mono text-xs">{item.documentNo || '-'}</span>
      ),
    },
    {
      key: 'expiryDate',
      header: t('document.expiryDate'),
      render: (item) => {
        if (!item.expiryDate) return <span className="text-muted-foreground">-</span>
        const daysLeft = Math.ceil((new Date(item.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        return (
          <div className="flex items-center gap-1">
            <span className="text-sm">{new Date(item.expiryDate).toLocaleDateString()}</span>
            {daysLeft < 0 && (
              <span className="text-xs text-destructive font-medium">
                ({Math.abs(daysLeft)} {t('alert.daysLeft')})
              </span>
            )}
            {daysLeft >= 0 && daysLeft <= 30 && (
              <span className="text-xs text-amber-500 font-medium">
                ({daysLeft} {t('alert.daysLeft')})
              </span>
            )}
          </div>
        )
      },
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (item) => {
        const st = getDocStatus(item)
        return <Badge variant={st.variant}>{t(st.tKey)}</Badge>
      },
    },
    {
      key: 'files',
      header: t('document.files'),
      render: (item) => (
        <Badge variant="secondary" className="text-xs">
          {item.files?.length || 0} {t('document.files').toLowerCase()}
        </Badge>
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
            <h1 className="text-2xl font-bold">{t('document.title')}</h1>
            <HelpTooltip helpKey="document" />
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="cursor-pointer hover:border-primary/50" onClick={() => { setStatusFilter(''); setPage(1) }}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t('common.total')}</p>
                  <p className="text-2xl font-bold">{statsData?.total || 0}</p>
                </div>
                <FileText className="h-8 w-8 text-primary opacity-80" />
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-destructive/50" onClick={() => { setStatusFilter('EXPIRED'); setPage(1) }}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t('document.expired')}</p>
                  <p className="text-2xl font-bold text-destructive">{statsData?.expired || 0}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-destructive opacity-80" />
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-warning/50" onClick={() => { setStatusFilter('EXPIRING'); setPage(1) }}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t('document.expiringSoon')}</p>
                  <p className="text-2xl font-bold text-amber-500">{statsData?.expiring || 0}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-amber-500 opacity-80" />
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-green-500/50" onClick={() => { setStatusFilter('VERIFIED'); setPage(1) }}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t('document.verified')}</p>
                  <p className="text-2xl font-bold text-green-600">{statsData?.verified || 0}</p>
                </div>
                <ShieldCheck className="h-8 w-8 text-green-600 opacity-80" />
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
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
              >
                <option value="">{t('common.all')} {t('common.status')}</option>
                <option value="EXPIRED">{t('document.expired')}</option>
                <option value="EXPIRING">{t('document.expiringSoon')}</option>
                <option value="VERIFIED">{t('document.verified')}</option>
              </select>
              <select
                className="h-9 rounded-md border border-input bg-card px-3 text-sm"
                value={categoryFilter}
                onChange={(e) => { setCategoryFilter(e.target.value); setPage(1) }}
              >
                <option value="">{t('common.all')} {t('common.category')}</option>
                <option value="IDENTITY">IDENTITY</option>
                <option value="IMMIGRATION">IMMIGRATION</option>
                <option value="EMPLOYMENT">EMPLOYMENT</option>
                <option value="MEDICAL">MEDICAL</option>
                <option value="SAFETY">SAFETY</option>
              </select>
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
          data={filteredDocs}
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
