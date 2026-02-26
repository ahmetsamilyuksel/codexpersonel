'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import * as Tabs from '@radix-ui/react-tabs'
import { AppLayout } from '@/components/layout/app-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { DataTable, type Column } from '@/components/ui/data-table'
import { HelpTooltip } from '@/components/ui/help-tooltip'
import { DictionaryCrud } from '@/components/settings/dictionary-crud'
import { useTranslations } from '@/hooks/use-translations'
import { useLocaleStore, getLocalizedName, getLocalizedLabel } from '@/store/locale-store'
import { useAuthStore } from '@/store/auth-store'
import apiClient from '@/lib/api-client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Settings,
  Globe,
  Flag,
  Briefcase,
  Network,
  Users,
  Clock,
  FileText,
  CalendarOff,
  Package,
  Wallet,
  Scale,
  Bell,
  Hash,
  PlusSquare,
  Languages,
  Shield,
  UserCog,
  ScrollText,
  Save,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Search,
} from 'lucide-react'

// ==================== Tab 1: General Settings ====================
function GeneralSettingsTab() {
  const { t } = useTranslations()
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await apiClient.get('/settings')
      return res.data.data || res.data
    },
  })

  const [form, setForm] = useState({
    companyName: '',
    companyAddress: '',
    timezone: 'Europe/Moscow',
    currency: 'RUB',
    dateFormat: 'DD.MM.YYYY',
    defaultLocale: 'tr',
  })

  React.useEffect(() => {
    if (settings && Array.isArray(settings)) {
      const getValue = (key: string) =>
        settings.find((s: any) => s.key === key)?.value || ''
      setForm({
        companyName: getValue('company.name') || 'SAELA',
        companyAddress: getValue('company.address') || '',
        timezone: getValue('general.timezone') || 'Europe/Moscow',
        currency: getValue('general.currency') || 'RUB',
        dateFormat: getValue('general.dateFormat') || 'DD.MM.YYYY',
        defaultLocale: getValue('general.defaultLocale') || 'tr',
      })
    }
  }, [settings])

  const handleSave = async () => {
    setSaving(true)
    try {
      const entries = [
        { category: 'company', key: 'company.name', value: form.companyName },
        { category: 'company', key: 'company.address', value: form.companyAddress },
        { category: 'general', key: 'general.timezone', value: form.timezone },
        { category: 'general', key: 'general.currency', value: form.currency },
        { category: 'general', key: 'general.dateFormat', value: form.dateFormat },
        { category: 'general', key: 'general.defaultLocale', value: form.defaultLocale },
      ]
      await apiClient.put('/settings', { settings: entries })
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    } catch {
      // handle error
    }
    setSaving(false)
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            {t('settings.general')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Input
              label={t('settings.company') + ' Name'}
              value={form.companyName}
              onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))}
            />
            <Input
              label={t('settings.company') + ' Address'}
              value={form.companyAddress}
              onChange={(e) => setForm((p) => ({ ...p, companyAddress: e.target.value }))}
            />
            <div>
              <label className="block text-sm font-medium mb-1">Timezone</label>
              <select
                className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                value={form.timezone}
                onChange={(e) => setForm((p) => ({ ...p, timezone: e.target.value }))}
              >
                <option value="Europe/Moscow">Europe/Moscow (MSK)</option>
                <option value="Europe/Istanbul">Europe/Istanbul (TRT)</option>
                <option value="Europe/Samara">Europe/Samara</option>
                <option value="Asia/Yekaterinburg">Asia/Yekaterinburg</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('common.currency')}</label>
              <select
                className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                value={form.currency}
                onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))}
              >
                <option value="RUB">RUB - Russian Ruble</option>
                <option value="TRY">TRY - Turkish Lira</option>
                <option value="USD">USD - US Dollar</option>
                <option value="EUR">EUR - Euro</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('common.language')}</label>
              <select
                className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                value={form.defaultLocale}
                onChange={(e) => setForm((p) => ({ ...p, defaultLocale: e.target.value }))}
              >
                <option value="tr">Turkish</option>
                <option value="ru">Russian</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>
          <div className="mt-4">
            <Button onClick={handleSave} loading={saving}>
              <Save className="h-4 w-4 mr-1" />
              {t('common.save')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ==================== Tab 7: Document Types ====================
function DocumentTypesTab() {
  const { t } = useTranslations()
  return (
    <DictionaryCrud
      endpoint="document-types"
      title={t('settings.documentTypes')}
      helpKey="document"
      extraColumns={[
        {
          key: 'category',
          header: t('common.category'),
          type: 'text',
        },
        {
          key: 'hasExpiry',
          header: 'Has Expiry',
          type: 'boolean',
          render: (item) => (
            <Badge variant={item.hasExpiry ? 'warning' : 'secondary'}>
              {item.hasExpiry ? t('common.yes') : t('common.no')}
            </Badge>
          ),
        },
        {
          key: 'defaultAlertDays',
          header: 'Alert Days',
          type: 'number',
        },
      ]}
      extraDefaults={{ category: '', hasExpiry: false, defaultAlertDays: 30 }}
    />
  )
}

// ==================== Tab 6: Shifts ====================
function ShiftsTab() {
  const { t } = useTranslations()
  return (
    <DictionaryCrud
      endpoint="shifts"
      title={t('settings.shifts')}
      helpKey="shift"
      extraColumns={[
        {
          key: 'startTime',
          header: t('attendance.checkIn'),
          type: 'text',
        },
        {
          key: 'endTime',
          header: t('attendance.checkOut'),
          type: 'text',
        },
        {
          key: 'breakMinutes',
          header: 'Break (min)',
          type: 'number',
        },
        {
          key: 'isNightShift',
          header: t('attendance.nightShift'),
          type: 'boolean',
          render: (item) => (
            <Badge variant={item.isNightShift ? 'warning' : 'secondary'}>
              {item.isNightShift ? t('common.yes') : t('common.no')}
            </Badge>
          ),
        },
      ]}
      extraDefaults={{ startTime: '08:00', endTime: '17:00', breakMinutes: 60, isNightShift: false }}
    />
  )
}

// ==================== Tab 8: Leave Types ====================
function LeaveTypesTab() {
  const { t } = useTranslations()
  return (
    <DictionaryCrud
      endpoint="leave-types"
      title={t('settings.leaveTypes')}
      helpKey="leave"
      extraColumns={[
        {
          key: 'isPaid',
          header: 'Paid',
          type: 'boolean',
          render: (item) => (
            <Badge variant={item.isPaid ? 'success' : 'secondary'}>
              {item.isPaid ? t('common.yes') : t('common.no')}
            </Badge>
          ),
        },
        {
          key: 'maxDaysYear',
          header: 'Max Days/Year',
          type: 'number',
        },
      ]}
      extraDefaults={{ isPaid: true, maxDaysYear: null }}
    />
  )
}

// ==================== Tab 11: Payroll Rules ====================
function PayrollRulesTab() {
  const { t } = useTranslations()
  const queryClient = useQueryClient()
  const { locale } = useLocaleStore()
  const [editingVersions, setEditingVersions] = useState<string | null>(null)
  const [versionForm, setVersionForm] = useState({
    rate: '',
    isPercentage: true,
    minBase: '',
    maxBase: '',
    effectiveFrom: '',
    notes: '',
  })

  const { data, isLoading } = useQuery({
    queryKey: ['payroll-rules'],
    queryFn: async () => {
      const res = await apiClient.get('/payroll-rules?limit=100')
      return res.data
    },
  })

  const addVersionMutation = useMutation({
    mutationFn: ({ ruleId, payload }: { ruleId: string; payload: any }) =>
      apiClient.post(`/payroll-rules/${ruleId}/versions`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-rules'] })
      setEditingVersions(null)
    },
  })

  return (
    <div className="space-y-4">
      <DictionaryCrud
        endpoint="payroll-rules"
        title={t('settings.payrollRules')}
        helpKey="payroll"
        extraColumns={[
          {
            key: 'category',
            header: t('common.category'),
            type: 'select',
            options: [
              { value: 'TAX', label: 'Tax' },
              { value: 'SOCIAL', label: 'Social' },
              { value: 'INSURANCE', label: 'Insurance' },
              { value: 'OTHER', label: 'Other' },
            ],
          },
        ]}
        extraDefaults={{ category: 'TAX' }}
      />
    </div>
  )
}

// ==================== Tab 12: Alert Rules ====================
function AlertRulesTab() {
  const { t } = useTranslations()
  return (
    <DictionaryCrud
      endpoint="alert-rules"
      title={t('settings.alertRules')}
      helpKey="alertDays"
      extraColumns={[
        {
          key: 'entity',
          header: 'Entity',
          type: 'text',
        },
        {
          key: 'dateField',
          header: 'Date Field',
          type: 'text',
        },
        {
          key: 'warningDays',
          header: 'Warning Days',
          type: 'number',
          render: (item) => (
            <Badge variant="warning">{String(item.warningDays ?? '')} days</Badge>
          ),
        },
        {
          key: 'criticalDays',
          header: 'Critical Days',
          type: 'number',
          render: (item) => (
            <Badge variant="destructive">{String(item.criticalDays ?? '')} days</Badge>
          ),
        },
        {
          key: 'notifyEmail',
          header: 'Email',
          type: 'boolean',
        },
        {
          key: 'notifyTelegram',
          header: 'Telegram',
          type: 'boolean',
        },
      ]}
      extraDefaults={{
        entity: '',
        dateField: '',
        warningDays: 30,
        criticalDays: 7,
        notifyEmail: false,
        notifyTelegram: false,
      }}
    />
  )
}

// ==================== Tab 13: Numbering Rules ====================
function NumberingRulesTab() {
  const { t } = useTranslations()
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['numbering-rules'],
    queryFn: async () => {
      const res = await apiClient.get('/numbering-rules')
      return res.data.data || res.data
    },
  })

  const [rules, setRules] = useState<any[]>([])

  React.useEffect(() => {
    if (data && Array.isArray(data)) {
      setRules(data.map((r: any) => ({ ...r })))
    }
  }, [data])

  const handleSave = async (rule: any) => {
    setSaving(true)
    try {
      await apiClient.put(`/numbering-rules/${rule.id}`, {
        prefix: rule.prefix,
        padLength: rule.padLength,
      })
      queryClient.invalidateQueries({ queryKey: ['numbering-rules'] })
    } catch {
      // handle error
    }
    setSaving(false)
  }

  const updateRule = (id: string, key: string, value: string | number) => {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [key]: value } : r))
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Hash className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">{t('settings.numberingRules')}</h3>
        <HelpTooltip helpKey="numberingRules" />
      </div>
      <div className="rounded-md border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-3 text-left font-medium text-muted-foreground">Entity</th>
              <th className="p-3 text-left font-medium text-muted-foreground">Prefix</th>
              <th className="p-3 text-left font-medium text-muted-foreground">Pad Length</th>
              <th className="p-3 text-left font-medium text-muted-foreground">Last Number</th>
              <th className="p-3 text-left font-medium text-muted-foreground">Preview</th>
              <th className="p-3 text-left font-medium text-muted-foreground">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id} className="border-t">
                <td className="p-3 font-mono text-xs font-medium">{rule.entity}</td>
                <td className="p-3">
                  <Input
                    value={rule.prefix}
                    onChange={(e) => updateRule(rule.id, 'prefix', e.target.value)}
                    className="w-32"
                  />
                </td>
                <td className="p-3">
                  <Input
                    type="number"
                    value={String(rule.padLength)}
                    onChange={(e) => updateRule(rule.id, 'padLength', parseInt(e.target.value) || 0)}
                    className="w-20"
                  />
                </td>
                <td className="p-3 text-muted-foreground">{rule.lastNumber}</td>
                <td className="p-3">
                  <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                    {rule.prefix}{String(rule.lastNumber + 1).padStart(rule.padLength, '0')}
                  </span>
                </td>
                <td className="p-3">
                  <Button size="sm" onClick={() => handleSave(rule)} loading={saving}>
                    <Save className="h-3 w-3 mr-1" />
                    {t('common.save')}
                  </Button>
                </td>
              </tr>
            ))}
            {rules.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                  {isLoading ? t('common.loading') : t('common.noData')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ==================== Tab 14: Custom Fields ====================
function CustomFieldsTab() {
  const { t } = useTranslations()
  const queryClient = useQueryClient()
  const { locale } = useLocaleStore()

  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    entity: 'Employee',
    fieldKey: '',
    labelTr: '',
    labelRu: '',
    labelEn: '',
    fieldType: 'TEXT',
    isRequired: false,
    isActive: true,
    sortOrder: 0,
    section: '',
  })

  const { data, isLoading } = useQuery({
    queryKey: ['custom-fields'],
    queryFn: async () => {
      const res = await apiClient.get('/custom-fields?limit=100')
      return res.data
    },
  })

  const createMutation = useMutation({
    mutationFn: (payload: typeof form) => apiClient.post('/custom-fields', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-fields'] })
      resetForm()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: typeof form }) =>
      apiClient.put(`/custom-fields/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-fields'] })
      resetForm()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/custom-fields/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['custom-fields'] }),
  })

  const resetForm = () => {
    setIsAdding(false)
    setEditingId(null)
    setForm({
      entity: 'Employee',
      fieldKey: '',
      labelTr: '',
      labelRu: '',
      labelEn: '',
      fieldType: 'TEXT',
      isRequired: false,
      isActive: true,
      sortOrder: 0,
      section: '',
    })
  }

  const startEdit = (item: any) => {
    setEditingId(item.id)
    setIsAdding(false)
    setForm({
      entity: item.entity,
      fieldKey: item.fieldKey,
      labelTr: item.labelTr,
      labelRu: item.labelRu,
      labelEn: item.labelEn,
      fieldType: item.fieldType,
      isRequired: item.isRequired,
      isActive: item.isActive,
      sortOrder: item.sortOrder,
      section: item.section || '',
    })
  }

  const handleSave = () => {
    if (editingId) {
      updateMutation.mutate({ id: editingId, payload: form })
    } else {
      createMutation.mutate(form)
    }
  }

  const columns: Column<any>[] = [
    { key: 'entity', header: 'Entity', render: (item) => <Badge variant="outline">{item.entity}</Badge> },
    { key: 'fieldKey', header: 'Field Key', render: (item) => <span className="font-mono text-xs">{item.fieldKey}</span> },
    { key: 'label', header: 'Label', render: (item) => getLocalizedLabel(item, locale) },
    { key: 'fieldType', header: t('common.type'), render: (item) => <Badge variant="secondary">{item.fieldType}</Badge> },
    { key: 'section', header: 'Section', render: (item) => item.section || '-' },
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
          <Button variant="ghost" size="icon" onClick={() => startEdit(item)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (window.confirm(t('common.confirm') + '?')) deleteMutation.mutate(item.id)
            }}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PlusSquare className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">{t('settings.customFields')}</h3>
          <HelpTooltip helpKey="customFields" />
        </div>
        <Button size="sm" onClick={() => { setIsAdding(true); setEditingId(null) }}>
          <Plus className="h-4 w-4 mr-1" />
          {t('common.add')}
        </Button>
      </div>

      {(isAdding || editingId) && (
        <Card className="border-primary/30">
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Entity</label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                  value={form.entity}
                  onChange={(e) => setForm((p) => ({ ...p, entity: e.target.value }))}
                >
                  <option value="Employee">Employee</option>
                  <option value="Worksite">Worksite</option>
                  <option value="Asset">Asset</option>
                </select>
              </div>
              <Input
                label="Field Key"
                value={form.fieldKey}
                onChange={(e) => setForm((p) => ({ ...p, fieldKey: e.target.value }))}
                required
                disabled={!!editingId}
              />
              <Input
                label="Label TR"
                value={form.labelTr}
                onChange={(e) => setForm((p) => ({ ...p, labelTr: e.target.value }))}
                required
              />
              <Input
                label="Label RU"
                value={form.labelRu}
                onChange={(e) => setForm((p) => ({ ...p, labelRu: e.target.value }))}
                required
              />
              <Input
                label="Label EN"
                value={form.labelEn}
                onChange={(e) => setForm((p) => ({ ...p, labelEn: e.target.value }))}
                required
              />
              <div>
                <label className="block text-sm font-medium mb-1">Field Type</label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                  value={form.fieldType}
                  onChange={(e) => setForm((p) => ({ ...p, fieldType: e.target.value }))}
                >
                  <option value="TEXT">Text</option>
                  <option value="NUMBER">Number</option>
                  <option value="DATE">Date</option>
                  <option value="BOOLEAN">Boolean</option>
                  <option value="SELECT">Select</option>
                  <option value="TEXTAREA">Textarea</option>
                </select>
              </div>
              <Input
                label="Section"
                value={form.section}
                onChange={(e) => setForm((p) => ({ ...p, section: e.target.value }))}
              />
              <Input
                label="Sort Order"
                type="number"
                value={String(form.sortOrder)}
                onChange={(e) => setForm((p) => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))}
              />
              <div className="flex items-end gap-4">
                <label className="flex items-center gap-2 h-9 text-sm">
                  <input
                    type="checkbox"
                    checked={form.isRequired}
                    onChange={(e) => setForm((p) => ({ ...p, isRequired: e.target.checked }))}
                    className="rounded border-input"
                  />
                  {t('common.required')}
                </label>
                <label className="flex items-center gap-2 h-9 text-sm">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                    className="rounded border-input"
                  />
                  {t('common.active')}
                </label>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <Button size="sm" onClick={handleSave} loading={createMutation.isPending || updateMutation.isPending}>
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

      <DataTable columns={columns} data={data?.data || []} loading={isLoading} emptyMessage={t('common.noData')} />
    </div>
  )
}

// ==================== Tab 15: Translations ====================
function TranslationsTab() {
  const { t } = useTranslations()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ tr: '', ru: '', en: '' })

  const { data, isLoading } = useQuery({
    queryKey: ['translations', search],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '100' })
      if (search) params.set('search', search)
      const res = await apiClient.get(`/translations?${params}`)
      return res.data
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      apiClient.put(`/translations/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['translations'] })
      setEditingId(null)
    },
  })

  const startEdit = (item: any) => {
    setEditingId(item.id)
    setEditForm({ tr: item.tr, ru: item.ru, en: item.en })
  }

  const columns: Column<any>[] = [
    { key: 'namespace', header: 'Namespace', render: (item) => <Badge variant="outline">{item.namespace}</Badge> },
    { key: 'key', header: 'Key', render: (item) => <span className="font-mono text-xs">{item.key}</span> },
    {
      key: 'tr',
      header: 'TR',
      render: (item) =>
        editingId === item.id ? (
          <Input
            value={editForm.tr}
            onChange={(e) => setEditForm((p) => ({ ...p, tr: e.target.value }))}
            className="text-xs"
          />
        ) : (
          <span className="text-xs">{item.tr}</span>
        ),
    },
    {
      key: 'ru',
      header: 'RU',
      render: (item) =>
        editingId === item.id ? (
          <Input
            value={editForm.ru}
            onChange={(e) => setEditForm((p) => ({ ...p, ru: e.target.value }))}
            className="text-xs"
          />
        ) : (
          <span className="text-xs">{item.ru}</span>
        ),
    },
    {
      key: 'en',
      header: 'EN',
      render: (item) =>
        editingId === item.id ? (
          <Input
            value={editForm.en}
            onChange={(e) => setEditForm((p) => ({ ...p, en: e.target.value }))}
            className="text-xs"
          />
        ) : (
          <span className="text-xs">{item.en}</span>
        ),
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (item) =>
        editingId === item.id ? (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => updateMutation.mutate({ id: item.id, payload: editForm })}
            >
              <Check className="h-4 w-4 text-success" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setEditingId(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button variant="ghost" size="icon" onClick={() => startEdit(item)}>
            <Pencil className="h-4 w-4" />
          </Button>
        ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Languages className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">{t('settings.translations')}</h3>
        </div>
        <div className="flex items-center gap-1">
          <Input
            placeholder={t('common.search') + '...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
        </div>
      </div>
      <DataTable columns={columns} data={data?.data || []} loading={isLoading} emptyMessage={t('common.noData')} />
    </div>
  )
}

// ==================== Tab 16: Roles & Permissions ====================
function RolesPermissionsTab() {
  const { t } = useTranslations()
  const { locale } = useLocaleStore()
  const queryClient = useQueryClient()
  const [selectedRole, setSelectedRole] = useState<string | null>(null)

  const { data: rolesData } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const res = await apiClient.get('/roles?limit=100')
      return res.data
    },
  })

  const { data: permissionsData } = useQuery({
    queryKey: ['permissions'],
    queryFn: async () => {
      const res = await apiClient.get('/permissions?limit=500')
      return res.data
    },
  })

  const { data: rolePerms } = useQuery({
    queryKey: ['role-permissions', selectedRole],
    queryFn: async () => {
      const res = await apiClient.get(`/roles/${selectedRole}/permissions`)
      return res.data.data || res.data
    },
    enabled: !!selectedRole,
  })

  const togglePermMutation = useMutation({
    mutationFn: ({ roleId, permissionId, action }: { roleId: string; permissionId: string; action: 'add' | 'remove' }) =>
      action === 'add'
        ? apiClient.post(`/roles/${roleId}/permissions`, { permissionId })
        : apiClient.delete(`/roles/${roleId}/permissions/${permissionId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-permissions', selectedRole] })
    },
  })

  const roles = rolesData?.data || []
  const permissions = permissionsData?.data || []
  const rolePermIds = (rolePerms || []).map((rp: any) => rp.permissionId || rp.id)

  const permByModule: Record<string, any[]> = {}
  permissions.forEach((p: any) => {
    if (!permByModule[p.module]) permByModule[p.module] = []
    permByModule[p.module].push(p)
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">{t('settings.roles')} & {t('settings.permissions')}</h3>
        <HelpTooltip helpKey="roles" />
      </div>
      <div className="grid grid-cols-4 gap-4">
        {/* Roles List */}
        <div className="col-span-1">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t('settings.roles')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {roles.map((role: any) => (
                  <button
                    key={role.id}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors cursor-pointer ${
                      selectedRole === role.id
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => setSelectedRole(role.id)}
                  >
                    <div className="font-medium">{getLocalizedName(role, locale)}</div>
                    <div className="text-xs opacity-70">{role.code}</div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Permissions Matrix */}
        <div className="col-span-3">
          {selectedRole ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{t('settings.permissions')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(permByModule).map(([module, perms]) => (
                    <div key={module}>
                      <h4 className="text-sm font-semibold mb-2 capitalize">{module}</h4>
                      <div className="flex flex-wrap gap-2">
                        {perms.map((perm: any) => {
                          const isAssigned = rolePermIds.includes(perm.id)
                          return (
                            <button
                              key={perm.id}
                              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                                isAssigned
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
                              }`}
                              onClick={() =>
                                togglePermMutation.mutate({
                                  roleId: selectedRole,
                                  permissionId: perm.id,
                                  action: isAssigned ? 'remove' : 'add',
                                })
                              }
                            >
                              {perm.action}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-4">
                <p className="text-muted-foreground text-sm text-center py-8">
                  Select a role to manage permissions
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

// ==================== Tab 17: Users ====================
function SettingsUsersTab() {
  const { t } = useTranslations()
  const { locale } = useLocaleStore()
  const queryClient = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    locale: 'tr',
    roleIds: [] as string[],
  })

  const { data: usersData, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await apiClient.get('/users?limit=100')
      return res.data
    },
  })

  const { data: rolesData } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const res = await apiClient.get('/roles?limit=100')
      return res.data
    },
  })

  const createMutation = useMutation({
    mutationFn: (payload: typeof form) => apiClient.post('/auth/register', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setShowAdd(false)
      setForm({ email: '', password: '', firstName: '', lastName: '', locale: 'tr', roleIds: [] })
    },
  })

  const columns: Column<any>[] = [
    {
      key: 'name',
      header: t('common.name'),
      render: (item) => (
        <span className="font-medium">{item.firstName} {item.lastName}</span>
      ),
    },
    { key: 'email', header: t('auth.email') },
    {
      key: 'roles',
      header: t('settings.roles'),
      render: (item) => (
        <div className="flex flex-wrap gap-1">
          {(item.userRoles || []).map((ur: any) => (
            <Badge key={ur.id} variant="outline">
              {getLocalizedName(ur.role, locale)}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (item) => (
        <Badge variant={item.status === 'ACTIVE' ? 'success' : 'secondary'}>
          {item.status}
        </Badge>
      ),
    },
    {
      key: 'lastLoginAt',
      header: 'Last Login',
      render: (item) =>
        item.lastLoginAt ? new Date(item.lastLoginAt).toLocaleString() : '-',
    },
  ]

  const roles = rolesData?.data || []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserCog className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">{t('settings.users')}</h3>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-1" />
          {t('common.add')}
        </Button>
      </div>

      {showAdd && (
        <Card className="border-primary/30">
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Input
                label={t('employee.firstName')}
                value={form.firstName}
                onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
                required
              />
              <Input
                label={t('employee.lastName')}
                value={form.lastName}
                onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
                required
              />
              <Input
                label={t('auth.email')}
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                required
              />
              <Input
                label={t('auth.password')}
                type="password"
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                required
              />
              <div>
                <label className="block text-sm font-medium mb-1">{t('settings.roles')}</label>
                <div className="flex flex-wrap gap-1">
                  {roles.map((role: any) => (
                    <label key={role.id} className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={form.roleIds.includes(role.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setForm((p) => ({ ...p, roleIds: [...p.roleIds, role.id] }))
                          } else {
                            setForm((p) => ({
                              ...p,
                              roleIds: p.roleIds.filter((id) => id !== role.id),
                            }))
                          }
                        }}
                        className="rounded border-input"
                      />
                      {getLocalizedName(role, locale)}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <Button size="sm" onClick={() => createMutation.mutate(form)} loading={createMutation.isPending}>
                <Check className="h-4 w-4 mr-1" />
                {t('common.save')}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>
                <X className="h-4 w-4 mr-1" />
                {t('common.cancel')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <DataTable columns={columns} data={usersData?.data || []} loading={isLoading} emptyMessage={t('common.noData')} />
    </div>
  )
}

// ==================== Tab 18: Audit Log ====================
function AuditLogTab() {
  const { t } = useTranslations()
  const [page, setPage] = useState(1)
  const [entityFilter, setEntityFilter] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, entityFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: '50',
        sort: 'createdAt',
        order: 'desc',
      })
      if (entityFilter) params.set('entity', entityFilter)
      const res = await apiClient.get(`/audit-logs?${params}`)
      return res.data
    },
  })

  const columns: Column<any>[] = [
    {
      key: 'createdAt',
      header: t('common.date'),
      render: (item) => (
        <span className="text-xs">{new Date(item.createdAt).toLocaleString()}</span>
      ),
    },
    {
      key: 'user',
      header: t('common.createdBy'),
      render: (item) =>
        item.user ? (
          <span className="text-sm">{item.user.firstName} {item.user.lastName}</span>
        ) : (
          '-'
        ),
    },
    {
      key: 'action',
      header: t('common.actions'),
      render: (item) => {
        const variants: Record<string, 'success' | 'warning' | 'destructive' | 'default'> = {
          CREATE: 'success',
          UPDATE: 'warning',
          DELETE: 'destructive',
        }
        return <Badge variant={variants[item.action] || 'default'}>{item.action}</Badge>
      },
    },
    { key: 'entity', header: 'Entity', render: (item) => <Badge variant="outline">{item.entity}</Badge> },
    {
      key: 'entityId',
      header: 'Entity ID',
      render: (item) => (
        <span className="font-mono text-xs">{item.entityId?.slice(0, 8) || '-'}</span>
      ),
    },
    {
      key: 'ipAddress',
      header: 'IP',
      render: (item) => <span className="text-xs text-muted-foreground">{item.ipAddress || '-'}</span>,
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ScrollText className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">{t('settings.auditLog')}</h3>
          <HelpTooltip helpKey="auditLog" />
        </div>
        <select
          className="h-9 rounded-md border border-input bg-card px-3 text-sm"
          value={entityFilter}
          onChange={(e) => {
            setEntityFilter(e.target.value)
            setPage(1)
          }}
        >
          <option value="">{t('common.all')} Entities</option>
          <option value="Employee">Employee</option>
          <option value="Worksite">Worksite</option>
          <option value="Nationality">Nationality</option>
          <option value="Profession">Profession</option>
          <option value="Department">Department</option>
          <option value="PayrollRun">PayrollRun</option>
          <option value="Asset">Asset</option>
          <option value="LeaveRequest">LeaveRequest</option>
        </select>
      </div>

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

// ==================== MAIN SETTINGS PAGE ====================
const tabConfig = [
  { value: 'general', icon: Globe, labelKey: 'settings.general' },
  { value: 'nationalities', icon: Flag, labelKey: 'settings.nationalities' },
  { value: 'professions', icon: Briefcase, labelKey: 'settings.professions' },
  { value: 'departments', icon: Network, labelKey: 'settings.departments' },
  { value: 'employee-types', icon: Users, labelKey: 'settings.employeeTypes' },
  { value: 'shifts', icon: Clock, labelKey: 'settings.shifts' },
  { value: 'document-types', icon: FileText, labelKey: 'settings.documentTypes' },
  { value: 'leave-types', icon: CalendarOff, labelKey: 'settings.leaveTypes' },
  { value: 'asset-categories', icon: Package, labelKey: 'settings.assetCategories' },
  { value: 'earning-deduction', icon: Wallet, labelKey: 'settings.earningCategories' },
  { value: 'payroll-rules', icon: Scale, labelKey: 'settings.payrollRules' },
  { value: 'alert-rules', icon: Bell, labelKey: 'settings.alertRules' },
  { value: 'numbering-rules', icon: Hash, labelKey: 'settings.numberingRules' },
  { value: 'custom-fields', icon: PlusSquare, labelKey: 'settings.customFields' },
  { value: 'translations', icon: Languages, labelKey: 'settings.translations' },
  { value: 'roles', icon: Shield, labelKey: 'settings.roles' },
  { value: 'users', icon: UserCog, labelKey: 'settings.users' },
  { value: 'audit-log', icon: ScrollText, labelKey: 'settings.auditLog' },
]

export default function SettingsPage() {
  const { t } = useTranslations()
  const [activeTab, setActiveTab] = useState('general')

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">{t('settings.title')}</h1>
        </div>

        <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
          <div className="flex gap-6">
            {/* Sidebar tabs */}
            <Tabs.List className="flex flex-col w-56 shrink-0 space-y-0.5">
              {tabConfig.map((tab) => (
                <Tabs.Trigger
                  key={tab.value}
                  value={tab.value}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left transition-colors cursor-pointer ${
                    activeTab === tab.value
                      ? 'bg-primary text-primary-foreground font-medium'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <tab.icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{t(tab.labelKey)}</span>
                </Tabs.Trigger>
              ))}
            </Tabs.List>

            {/* Tab content */}
            <div className="flex-1 min-w-0">
              <Tabs.Content value="general">
                <GeneralSettingsTab />
              </Tabs.Content>

              <Tabs.Content value="nationalities">
                <DictionaryCrud
                  endpoint="nationalities"
                  title={t('settings.nationalities')}
                  helpKey="workStatus"
                />
              </Tabs.Content>

              <Tabs.Content value="professions">
                <DictionaryCrud
                  endpoint="professions"
                  title={t('settings.professions')}
                />
              </Tabs.Content>

              <Tabs.Content value="departments">
                <DictionaryCrud
                  endpoint="departments"
                  title={t('settings.departments')}
                  helpKey="department"
                  extraColumns={[
                    {
                      key: 'parentId',
                      header: 'Parent',
                      type: 'text',
                    },
                  ]}
                  extraDefaults={{ parentId: null }}
                />
              </Tabs.Content>

              <Tabs.Content value="employee-types">
                <DictionaryCrud
                  endpoint="employee-types"
                  title={t('settings.employeeTypes')}
                />
              </Tabs.Content>

              <Tabs.Content value="shifts">
                <ShiftsTab />
              </Tabs.Content>

              <Tabs.Content value="document-types">
                <DocumentTypesTab />
              </Tabs.Content>

              <Tabs.Content value="leave-types">
                <LeaveTypesTab />
              </Tabs.Content>

              <Tabs.Content value="asset-categories">
                <DictionaryCrud
                  endpoint="asset-categories"
                  title={t('settings.assetCategories')}
                  helpKey="asset"
                />
              </Tabs.Content>

              <Tabs.Content value="earning-deduction">
                <div className="space-y-8">
                  <DictionaryCrud
                    endpoint="earning-categories"
                    title={t('settings.earningCategories')}
                  />
                  <hr className="border-border" />
                  <DictionaryCrud
                    endpoint="deduction-categories"
                    title={t('settings.deductionCategories')}
                  />
                </div>
              </Tabs.Content>

              <Tabs.Content value="payroll-rules">
                <PayrollRulesTab />
              </Tabs.Content>

              <Tabs.Content value="alert-rules">
                <AlertRulesTab />
              </Tabs.Content>

              <Tabs.Content value="numbering-rules">
                <NumberingRulesTab />
              </Tabs.Content>

              <Tabs.Content value="custom-fields">
                <CustomFieldsTab />
              </Tabs.Content>

              <Tabs.Content value="translations">
                <TranslationsTab />
              </Tabs.Content>

              <Tabs.Content value="roles">
                <RolesPermissionsTab />
              </Tabs.Content>

              <Tabs.Content value="users">
                <SettingsUsersTab />
              </Tabs.Content>

              <Tabs.Content value="audit-log">
                <AuditLogTab />
              </Tabs.Content>
            </div>
          </div>
        </Tabs.Root>
      </div>
    </AppLayout>
  )
}
