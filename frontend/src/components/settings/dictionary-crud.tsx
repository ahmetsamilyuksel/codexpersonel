'use client'

import React, { useState } from 'react'
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
import { Plus, Pencil, Trash2, Check, X, Search } from 'lucide-react'

interface DictionaryItem {
  id: string
  code: string
  nameTr: string
  nameRu: string
  nameEn: string
  isActive: boolean
  sortOrder: number
  [key: string]: unknown
}

interface ExtraColumn {
  key: string
  header: string
  type?: 'text' | 'number' | 'boolean' | 'select'
  options?: { value: string; label: string }[]
  render?: (item: DictionaryItem) => React.ReactNode
}

interface DictionaryCrudProps {
  endpoint: string
  title: string
  helpKey?: string
  extraColumns?: ExtraColumn[]
  extraDefaults?: Record<string, unknown>
}

interface FormData {
  code: string
  nameTr: string
  nameRu: string
  nameEn: string
  isActive: boolean
  sortOrder: number
  [key: string]: unknown
}

export function DictionaryCrud({
  endpoint,
  title,
  helpKey,
  extraColumns = [],
  extraDefaults = {},
}: DictionaryCrudProps) {
  const { t } = useTranslations()
  const { locale } = useLocaleStore()
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [formData, setFormData] = useState<FormData>({
    code: '',
    nameTr: '',
    nameRu: '',
    nameEn: '',
    isActive: true,
    sortOrder: 0,
    ...extraDefaults,
  })
  const [error, setError] = useState('')
  const limit = 50

  const queryKey = [endpoint, page, search]

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        sort: 'sortOrder',
        order: 'asc',
      })
      if (search) params.set('search', search)
      const res = await apiClient.get(`/${endpoint}?${params}`)
      return res.data
    },
  })

  const createMutation = useMutation({
    mutationFn: (payload: FormData) => apiClient.post(`/${endpoint}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [endpoint] })
      resetForm()
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Failed to create')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: FormData }) =>
      apiClient.put(`/${endpoint}/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [endpoint] })
      resetForm()
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Failed to update')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/${endpoint}/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [endpoint] })
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Failed to delete')
    },
  })

  const resetForm = () => {
    setEditingId(null)
    setIsAdding(false)
    setFormData({
      code: '',
      nameTr: '',
      nameRu: '',
      nameEn: '',
      isActive: true,
      sortOrder: 0,
      ...extraDefaults,
    })
    setError('')
  }

  const startEdit = (item: DictionaryItem) => {
    setEditingId(item.id)
    setIsAdding(false)
    const data: FormData = {
      code: item.code,
      nameTr: item.nameTr,
      nameRu: item.nameRu,
      nameEn: item.nameEn,
      isActive: item.isActive,
      sortOrder: item.sortOrder,
    }
    extraColumns.forEach((col) => {
      data[col.key] = item[col.key] as string
    })
    setFormData(data)
    setError('')
  }

  const startAdd = () => {
    setIsAdding(true)
    setEditingId(null)
    setFormData({
      code: '',
      nameTr: '',
      nameRu: '',
      nameEn: '',
      isActive: true,
      sortOrder: 0,
      ...extraDefaults,
    })
    setError('')
  }

  const handleSave = () => {
    if (!formData.code || !formData.nameTr || !formData.nameRu || !formData.nameEn) {
      setError('Code, Name (TR), Name (RU), and Name (EN) are required')
      return
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, payload: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const handleDelete = (id: string) => {
    if (window.confirm(t('common.confirm') + '?')) {
      deleteMutation.mutate(id)
    }
  }

  const handleSearch = () => {
    setSearch(searchInput)
    setPage(1)
  }

  const updateField = (key: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  const columns: Column<DictionaryItem>[] = [
    {
      key: 'code',
      header: t('common.code'),
      sortable: true,
      render: (item) => <span className="font-mono text-xs font-medium">{item.code}</span>,
    },
    {
      key: 'name',
      header: t('common.name'),
      render: (item) => getLocalizedName(item, locale),
    },
    {
      key: 'nameTr',
      header: 'TR',
      render: (item) => <span className="text-xs text-muted-foreground">{item.nameTr}</span>,
    },
    {
      key: 'nameRu',
      header: 'RU',
      render: (item) => <span className="text-xs text-muted-foreground">{item.nameRu}</span>,
    },
    {
      key: 'nameEn',
      header: 'EN',
      render: (item) => <span className="text-xs text-muted-foreground">{item.nameEn}</span>,
    },
    ...extraColumns.map((ec) => ({
      key: ec.key,
      header: ec.header,
      render: ec.render
        ? ec.render
        : (item: DictionaryItem) => String(item[ec.key] ?? ''),
    })),
    {
      key: 'sortOrder',
      header: '#',
      render: (item) => <span className="text-xs">{item.sortOrder}</span>,
    },
    {
      key: 'isActive',
      header: t('common.status'),
      render: (item) => (
        <Badge variant={item.isActive ? 'success' : 'secondary'}>
          {item.isActive ? t('common.active') : t('common.inactive')}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (item) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation()
              startEdit(item)
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation()
              handleDelete(item.id)
            }}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ]

  const isSaving = createMutation.isPending || updateMutation.isPending

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">{title}</h3>
          {helpKey && <HelpTooltip helpKey={helpKey} />}
          {data?.pagination && (
            <span className="text-sm text-muted-foreground">
              ({data.pagination.total})
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Input
              placeholder={t('common.search') + '...'}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-48"
            />
            <Button variant="outline" size="icon" onClick={handleSearch}>
              <Search className="h-4 w-4" />
            </Button>
          </div>
          <Button size="sm" onClick={startAdd} disabled={isAdding}>
            <Plus className="h-4 w-4 mr-1" />
            {t('common.add')}
          </Button>
        </div>
      </div>

      {/* Add/Edit Form */}
      {(isAdding || editingId) && (
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              {editingId ? t('common.edit') : t('common.add')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-3 rounded-md bg-destructive/10 p-2 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <Input
                label={t('common.code')}
                value={formData.code}
                onChange={(e) => updateField('code', e.target.value)}
                required
                disabled={!!editingId}
              />
              <Input
                label="Name (TR)"
                value={formData.nameTr}
                onChange={(e) => updateField('nameTr', e.target.value)}
                required
              />
              <Input
                label="Name (RU)"
                value={formData.nameRu}
                onChange={(e) => updateField('nameRu', e.target.value)}
                required
              />
              <Input
                label="Name (EN)"
                value={formData.nameEn}
                onChange={(e) => updateField('nameEn', e.target.value)}
                required
              />
              <Input
                label="Sort Order"
                type="number"
                value={String(formData.sortOrder)}
                onChange={(e) => updateField('sortOrder', parseInt(e.target.value) || 0)}
              />
              <div className="flex items-end gap-2">
                <label className="flex items-center gap-2 h-9 text-sm">
                  <input
                    type="checkbox"
                    checked={formData.isActive as boolean}
                    onChange={(e) => updateField('isActive', e.target.checked)}
                    className="rounded border-input"
                  />
                  {t('common.active')}
                </label>
              </div>
              {/* Extra columns as form fields */}
              {extraColumns.map((ec) => {
                if (ec.type === 'boolean') {
                  return (
                    <div key={ec.key} className="flex items-end gap-2">
                      <label className="flex items-center gap-2 h-9 text-sm">
                        <input
                          type="checkbox"
                          checked={!!formData[ec.key]}
                          onChange={(e) => updateField(ec.key, e.target.checked)}
                          className="rounded border-input"
                        />
                        {ec.header}
                      </label>
                    </div>
                  )
                }
                if (ec.type === 'select' && ec.options) {
                  return (
                    <div key={ec.key}>
                      <label className="block text-sm font-medium mb-1">{ec.header}</label>
                      <select
                        className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                        value={String(formData[ec.key] || '')}
                        onChange={(e) => updateField(ec.key, e.target.value)}
                      >
                        <option value="">--</option>
                        {ec.options.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )
                }
                return (
                  <Input
                    key={ec.key}
                    label={ec.header}
                    type={ec.type === 'number' ? 'number' : 'text'}
                    value={String(formData[ec.key] || '')}
                    onChange={(e) =>
                      updateField(
                        ec.key,
                        ec.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value
                      )
                    }
                  />
                )
              })}
            </div>
            <div className="flex items-center gap-2 mt-3">
              <Button size="sm" onClick={handleSave} loading={isSaving}>
                <Check className="h-4 w-4 mr-1" />
                {t('common.save')}
              </Button>
              <Button size="sm" variant="outline" onClick={resetForm}>
                <X className="h-4 w-4 mr-1" />
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
  )
}
