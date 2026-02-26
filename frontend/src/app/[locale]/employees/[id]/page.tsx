'use client'

import React, { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { HelpTooltip } from '@/components/ui/help-tooltip'
import { useTranslations } from '@/hooks/use-translations'
import { useLocaleStore, getLocalizedName } from '@/store/locale-store'
import apiClient from '@/lib/api-client'
import {
  ArrowLeft, Save, User, IdCard, Briefcase, Building2, Wallet,
  FileText, Clock, Calendar, Package, ArrowRightLeft, Upload,
} from 'lucide-react'

type Tab = 'general' | 'identity' | 'workStatus' | 'employment' | 'salary' | 'documents' | 'attendance' | 'leaves' | 'assets' | 'transfers'

const TABS: { key: Tab; icon: React.ElementType; labelKey: string }[] = [
  { key: 'general', icon: User, labelKey: 'employee.general' },
  { key: 'identity', icon: IdCard, labelKey: 'identity.title' },
  { key: 'workStatus', icon: Briefcase, labelKey: 'workStatus.title' },
  { key: 'employment', icon: Building2, labelKey: 'employment.title' },
  { key: 'salary', icon: Wallet, labelKey: 'salary.title' },
  { key: 'documents', icon: FileText, labelKey: 'document.title' },
  { key: 'attendance', icon: Clock, labelKey: 'attendance.title' },
  { key: 'leaves', icon: Calendar, labelKey: 'leave.title' },
  { key: 'assets', icon: Package, labelKey: 'asset.title' },
  { key: 'transfers', icon: ArrowRightLeft, labelKey: 'transfer.title' },
]

export default function EmployeeDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = use(params)
  const { t } = useTranslations()
  const localeStore = useLocaleStore()
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<Tab>('general')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [employee, setEmployee] = useState<any>(null)

  // Form states
  const [general, setGeneral] = useState<any>({})
  const [identity, setIdentity] = useState<any>({})
  const [workStatus, setWorkStatus] = useState<any>({})
  const [employment, setEmployment] = useState<any>({})
  const [salary, setSalary] = useState<any>({})
  const [documents, setDocuments] = useState<any[]>([])
  const [attendance, setAttendance] = useState<any[]>([])
  const [leaves, setLeaves] = useState<any[]>([])
  const [assets, setAssets] = useState<any[]>([])
  const [transfers, setTransfers] = useState<any[]>([])

  // Dictionaries
  const [nationalities, setNationalities] = useState<any[]>([])
  const [professions, setProfessions] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [worksites, setWorksites] = useState<any[]>([])
  const [employeeTypes, setEmployeeTypes] = useState<any[]>([])
  const [shifts, setShifts] = useState<any[]>([])
  const [documentTypes, setDocumentTypes] = useState<any[]>([])

  useEffect(() => {
    loadEmployee()
    loadDictionaries()
  }, [id])

  const loadEmployee = async () => {
    try {
      setLoading(true)
      const { data } = await apiClient.get(`/employees/${id}`)
      if (data.success) {
        const e = data.data
        setEmployee(e)
        setGeneral({
          firstName: e.firstName || '', lastName: e.lastName || '', patronymic: e.patronymic || '',
          phone: e.phone || '', email: e.email || '', birthDate: e.birthDate?.slice(0, 10) || '',
          gender: e.gender || '', status: e.status || 'ACTIVE',
          nationalityId: e.nationalityId || '', professionId: e.professionId || '', departmentId: e.departmentId || '',
        })
        setIdentity(e.identity || {})
        setWorkStatus(e.workStatus || {})
        setEmployment(e.employment || {})
        setSalary(e.salaryProfile || {})
      }
    } catch { /* ignore */ } finally { setLoading(false) }
  }

  const loadDictionaries = async () => {
    try {
      const [nat, prof, dept, ws, et, sh, dt] = await Promise.all([
        apiClient.get('/nationalities?limit=200'), apiClient.get('/professions?limit=200'),
        apiClient.get('/departments?limit=200'), apiClient.get('/worksites?limit=200&status=ACTIVE'),
        apiClient.get('/employee-types?limit=200'), apiClient.get('/shifts?limit=200'),
        apiClient.get('/document-types?limit=200'),
      ])
      setNationalities(nat.data?.data || [])
      setProfessions(prof.data?.data || [])
      setDepartments(dept.data?.data || [])
      setWorksites(ws.data?.data || [])
      setEmployeeTypes(et.data?.data || [])
      setShifts(sh.data?.data || [])
      setDocumentTypes(dt.data?.data || [])
    } catch { /* ignore */ }
  }

  const loadTabData = async (tab: Tab) => {
    try {
      if (tab === 'documents' && documents.length === 0) {
        const { data } = await apiClient.get(`/employees/${id}/documents`)
        setDocuments(data?.data || [])
      } else if (tab === 'attendance' && attendance.length === 0) {
        const { data } = await apiClient.get(`/attendance?employeeId=${id}&limit=50`)
        setAttendance(data?.data || [])
      } else if (tab === 'leaves' && leaves.length === 0) {
        const { data } = await apiClient.get(`/leaves?employeeId=${id}&limit=50`)
        setLeaves(data?.data || [])
      } else if (tab === 'assets' && assets.length === 0) {
        const { data } = await apiClient.get(`/assets?assigneeId=${id}&limit=50`)
        setAssets(data?.data || [])
      } else if (tab === 'transfers' && transfers.length === 0) {
        const { data } = await apiClient.get(`/transfers?employeeId=${id}&limit=50`)
        setTransfers(data?.data || [])
      }
    } catch { /* ignore */ }
  }

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab)
    loadTabData(tab)
  }

  const saveGeneral = async () => {
    setSaving(true)
    try {
      await apiClient.put(`/employees/${id}`, {
        ...general,
        birthDate: general.birthDate || null,
      })
      await loadEmployee()
    } catch { /* ignore */ } finally { setSaving(false) }
  }

  const saveIdentity = async () => {
    setSaving(true)
    try {
      await apiClient.put(`/employees/${id}/identity`, {
        passportNo: identity.passportNo || null,
        passportIssueDate: identity.passportIssueDate?.slice(0, 10) || null,
        passportExpiryDate: identity.passportExpiryDate?.slice(0, 10) || null,
        passportIssuedBy: identity.passportIssuedBy || null,
        snils: identity.snils || null,
        inn: identity.inn || null,
        registrationAddress: identity.registrationAddress || null,
      })
      await loadEmployee()
    } catch { /* ignore */ } finally { setSaving(false) }
  }

  const saveWorkStatus = async () => {
    setSaving(true)
    try {
      await apiClient.put(`/employees/${id}/work-status`, {
        workStatusType: workStatus.workStatusType || 'LOCAL',
        permitNumber: workStatus.permitNumber || null,
        permitIssueDate: workStatus.permitIssueDate?.slice(0, 10) || null,
        permitExpiryDate: workStatus.permitExpiryDate?.slice(0, 10) || null,
        permitIssuedBy: workStatus.permitIssuedBy || null,
        migrationCardNumber: workStatus.migrationCardNumber || null,
        migrationCardDate: workStatus.migrationCardDate?.slice(0, 10) || null,
        migrationCardExpiry: workStatus.migrationCardExpiry?.slice(0, 10) || null,
        registrationDate: workStatus.registrationDate?.slice(0, 10) || null,
        registrationExpiry: workStatus.registrationExpiry?.slice(0, 10) || null,
        region: workStatus.region || null,
      })
      await loadEmployee()
    } catch { /* ignore */ } finally { setSaving(false) }
  }

  const saveEmployment = async () => {
    setSaving(true)
    try {
      await apiClient.put(`/employees/${id}/employment`, {
        worksiteId: employment.worksiteId || null,
        employeeTypeId: employment.employeeTypeId || null,
        shiftId: employment.shiftId || null,
        startDate: employment.startDate?.slice(0, 10) || null,
        endDate: employment.endDate?.slice(0, 10) || null,
        position: employment.position || null,
        contractType: employment.contractType || null,
        contractNo: employment.contractNo || null,
        contractDate: employment.contractDate?.slice(0, 10) || null,
      })
      await loadEmployee()
    } catch { /* ignore */ } finally { setSaving(false) }
  }

  const saveSalary = async () => {
    setSaving(true)
    try {
      await apiClient.put(`/employees/${id}/salary`, {
        paymentType: salary.paymentType || 'MONTHLY',
        currency: salary.currency || 'RUB',
        grossSalary: salary.grossSalary ? Number(salary.grossSalary) : null,
        netSalary: salary.netSalary ? Number(salary.netSalary) : null,
        dailyRate: salary.dailyRate ? Number(salary.dailyRate) : null,
        hourlyRate: salary.hourlyRate ? Number(salary.hourlyRate) : null,
        overtimeMultiplier: salary.overtimeMultiplier ? Number(salary.overtimeMultiplier) : 1.5,
        nightMultiplier: salary.nightMultiplier ? Number(salary.nightMultiplier) : 1.2,
        holidayMultiplier: salary.holidayMultiplier ? Number(salary.holidayMultiplier) : 2.0,
        taxStatus: salary.taxStatus || 'RESIDENT',
      })
      await loadEmployee()
    } catch { /* ignore */ } finally { setSaving(false) }
  }

  const updateField = (setter: any, field: string, value: any) => {
    setter((prev: any) => ({ ...prev, [field]: value }))
  }

  const SelectField = ({ label, value, onChange, options, helpKey }: any) => (
    <div>
      <label className="text-sm font-medium flex items-center gap-1">
        {label} {helpKey && <HelpTooltip helpKey={helpKey} />}
      </label>
      <select className="mt-1 w-full h-9 rounded-md border border-input bg-card px-3 text-sm" value={value || ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">--</option>
        {options.map((o: any) => (
          <option key={o.id || o.value} value={o.id || o.value}>
            {o.name || getLocalizedName(o, localeStore.locale) || o.label}
          </option>
        ))}
      </select>
    </div>
  )

  const FormInput = ({ label, value, onChange, type = 'text', helpKey }: any) => (
    <div>
      <label className="text-sm font-medium flex items-center gap-1">
        {label} {helpKey && <HelpTooltip helpKey={helpKey} />}
      </label>
      <input
        type={type} className="mt-1 w-full h-9 rounded-md border border-input bg-card px-3 text-sm"
        value={value || ''} onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <svg className="h-8 w-8 animate-spin text-primary" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      </AppLayout>
    )
  }

  if (!employee) {
    return (
      <AppLayout>
        <div className="text-center py-16 text-muted-foreground">
          {t('common.noData')}
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push(`/${locale}/employees`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary">
                {employee.firstName?.[0]}{employee.lastName?.[0]}
              </div>
              <div>
                <h1 className="text-2xl font-bold">{employee.firstName} {employee.lastName}</h1>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="font-mono">{employee.employeeNo}</span>
                  <Badge variant={employee.status === 'ACTIVE' ? 'success' : 'secondary'}>{employee.status}</Badge>
                  {employee.workStatus?.workStatusType && (
                    <Badge variant="default">{employee.workStatus.workStatusType}</Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1 border-b">
          {TABS.map(({ key, icon: Icon, labelKey }) => (
            <button
              key={key}
              onClick={() => handleTabChange(key)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t(labelKey)}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'general' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{t('employee.general')}</span>
                <Button onClick={saveGeneral} loading={saving}><Save className="h-4 w-4 mr-1" />{t('common.save')}</Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <FormInput label={t('employee.firstName')} value={general.firstName} onChange={(v: string) => updateField(setGeneral, 'firstName', v)} />
                <FormInput label={t('employee.lastName')} value={general.lastName} onChange={(v: string) => updateField(setGeneral, 'lastName', v)} />
                <FormInput label={t('employee.patronymic')} value={general.patronymic} onChange={(v: string) => updateField(setGeneral, 'patronymic', v)} />
                <FormInput label={t('employee.phone')} value={general.phone} onChange={(v: string) => updateField(setGeneral, 'phone', v)} />
                <FormInput label={t('employee.email')} value={general.email} type="email" onChange={(v: string) => updateField(setGeneral, 'email', v)} />
                <FormInput label={t('employee.birthDate')} value={general.birthDate} type="date" onChange={(v: string) => updateField(setGeneral, 'birthDate', v)} />
                <SelectField label={t('employee.gender')} value={general.gender} onChange={(v: string) => updateField(setGeneral, 'gender', v)}
                  options={[{ value: 'MALE', label: t('common.male') }, { value: 'FEMALE', label: t('common.female') }]} />
                <SelectField label={t('common.status')} value={general.status} onChange={(v: string) => updateField(setGeneral, 'status', v)}
                  options={[{ value: 'ACTIVE', label: t('common.active') }, { value: 'INACTIVE', label: t('common.inactive') }, { value: 'TERMINATED', label: t('common.completed') }]} />
                <SelectField label={t('employee.nationality')} value={general.nationalityId} onChange={(v: string) => updateField(setGeneral, 'nationalityId', v)} options={nationalities} helpKey="nationality" />
                <SelectField label={t('employee.profession')} value={general.professionId} onChange={(v: string) => updateField(setGeneral, 'professionId', v)} options={professions} />
                <SelectField label={t('employee.department')} value={general.departmentId} onChange={(v: string) => updateField(setGeneral, 'departmentId', v)} options={departments} />
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'identity' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{t('identity.title')}</span>
                <Button onClick={saveIdentity} loading={saving}><Save className="h-4 w-4 mr-1" />{t('common.save')}</Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <FormInput label={t('identity.passportNo')} value={identity.passportNo} onChange={(v: string) => updateField(setIdentity, 'passportNo', v)} helpKey="passport" />
                <FormInput label={t('identity.passportIssueDate')} value={identity.passportIssueDate?.slice(0, 10)} type="date" onChange={(v: string) => updateField(setIdentity, 'passportIssueDate', v)} />
                <FormInput label={t('identity.passportExpiryDate')} value={identity.passportExpiryDate?.slice(0, 10)} type="date" onChange={(v: string) => updateField(setIdentity, 'passportExpiryDate', v)} />
                <FormInput label={t('identity.passportIssuedBy')} value={identity.passportIssuedBy} onChange={(v: string) => updateField(setIdentity, 'passportIssuedBy', v)} />
                <FormInput label={t('identity.snils')} value={identity.snils} onChange={(v: string) => updateField(setIdentity, 'snils', v)} helpKey="snils" />
                <FormInput label={t('identity.inn')} value={identity.inn} onChange={(v: string) => updateField(setIdentity, 'inn', v)} helpKey="inn" />
                <div className="md:col-span-2 lg:col-span-3">
                  <FormInput label={t('identity.registrationAddress')} value={identity.registrationAddress} onChange={(v: string) => updateField(setIdentity, 'registrationAddress', v)} />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'workStatus' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{t('workStatus.title')}</span>
                <Button onClick={saveWorkStatus} loading={saving}><Save className="h-4 w-4 mr-1" />{t('common.save')}</Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <SelectField label={t('workStatus.type')} value={workStatus.workStatusType} onChange={(v: string) => updateField(setWorkStatus, 'workStatusType', v)} helpKey="workStatus"
                  options={['LOCAL', 'PATENT', 'VISA', 'WORK_PERMIT', 'RESIDENCE_PERMIT'].map(v => ({ value: v, label: t(`workStatus.${v.toLowerCase().replace('_', '')}`) || v }))} />
                <FormInput label={t('workStatus.permitNumber')} value={workStatus.permitNumber} onChange={(v: string) => updateField(setWorkStatus, 'permitNumber', v)} />
                <FormInput label={t('workStatus.permitIssueDate')} value={workStatus.permitIssueDate?.slice(0, 10)} type="date" onChange={(v: string) => updateField(setWorkStatus, 'permitIssueDate', v)} />
                <FormInput label={t('workStatus.permitExpiryDate')} value={workStatus.permitExpiryDate?.slice(0, 10)} type="date" onChange={(v: string) => updateField(setWorkStatus, 'permitExpiryDate', v)} />
                <FormInput label={t('workStatus.permitIssuedBy')} value={workStatus.permitIssuedBy} onChange={(v: string) => updateField(setWorkStatus, 'permitIssuedBy', v)} />
                <FormInput label={t('workStatus.migrationCardNumber')} value={workStatus.migrationCardNumber} onChange={(v: string) => updateField(setWorkStatus, 'migrationCardNumber', v)} />
                <FormInput label={t('workStatus.migrationCardDate')} value={workStatus.migrationCardDate?.slice(0, 10)} type="date" onChange={(v: string) => updateField(setWorkStatus, 'migrationCardDate', v)} />
                <FormInput label={t('workStatus.migrationCardExpiry')} value={workStatus.migrationCardExpiry?.slice(0, 10)} type="date" onChange={(v: string) => updateField(setWorkStatus, 'migrationCardExpiry', v)} />
                <FormInput label={t('workStatus.registrationDate')} value={workStatus.registrationDate?.slice(0, 10)} type="date" onChange={(v: string) => updateField(setWorkStatus, 'registrationDate', v)} />
                <FormInput label={t('workStatus.registrationExpiry')} value={workStatus.registrationExpiry?.slice(0, 10)} type="date" onChange={(v: string) => updateField(setWorkStatus, 'registrationExpiry', v)} />
                <FormInput label={t('workStatus.region')} value={workStatus.region} onChange={(v: string) => updateField(setWorkStatus, 'region', v)} />
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'employment' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{t('employment.title')}</span>
                <Button onClick={saveEmployment} loading={saving}><Save className="h-4 w-4 mr-1" />{t('common.save')}</Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <SelectField label={t('employment.worksite')} value={employment.worksiteId} onChange={(v: string) => updateField(setEmployment, 'worksiteId', v)} options={worksites} helpKey="worksite" />
                <SelectField label={t('employment.employeeType')} value={employment.employeeTypeId} onChange={(v: string) => updateField(setEmployment, 'employeeTypeId', v)} options={employeeTypes} />
                <SelectField label={t('employment.shift')} value={employment.shiftId} onChange={(v: string) => updateField(setEmployment, 'shiftId', v)} options={shifts} />
                <FormInput label={t('employment.position')} value={employment.position} onChange={(v: string) => updateField(setEmployment, 'position', v)} />
                <FormInput label={t('employment.startDate')} value={employment.startDate?.slice(0, 10)} type="date" onChange={(v: string) => updateField(setEmployment, 'startDate', v)} />
                <FormInput label={t('employment.endDate')} value={employment.endDate?.slice(0, 10)} type="date" onChange={(v: string) => updateField(setEmployment, 'endDate', v)} />
                <SelectField label={t('employment.contractType')} value={employment.contractType} onChange={(v: string) => updateField(setEmployment, 'contractType', v)}
                  options={[{ value: 'INDEFINITE', label: 'Indefinite' }, { value: 'FIXED_TERM', label: 'Fixed Term' }, { value: 'CIVIL', label: 'Civil' }, { value: 'SUBCONTRACT', label: 'Subcontract' }]} />
                <FormInput label={t('employment.contractNo')} value={employment.contractNo} onChange={(v: string) => updateField(setEmployment, 'contractNo', v)} />
                <FormInput label={t('employment.contractDate')} value={employment.contractDate?.slice(0, 10)} type="date" onChange={(v: string) => updateField(setEmployment, 'contractDate', v)} />
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'salary' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{t('salary.title')}</span>
                <Button onClick={saveSalary} loading={saving}><Save className="h-4 w-4 mr-1" />{t('common.save')}</Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <SelectField label={t('salary.paymentType')} value={salary.paymentType} onChange={(v: string) => updateField(setSalary, 'paymentType', v)} helpKey="salary"
                  options={[{ value: 'MONTHLY', label: t('salary.monthly') }, { value: 'DAILY', label: t('salary.daily') }, { value: 'HOURLY', label: t('salary.hourly') }]} />
                <SelectField label={t('salary.currency')} value={salary.currency} onChange={(v: string) => updateField(setSalary, 'currency', v)}
                  options={[{ value: 'RUB', label: '₽ RUB' }, { value: 'USD', label: '$ USD' }, { value: 'EUR', label: '€ EUR' }, { value: 'TRY', label: '₺ TRY' }]} />
                <SelectField label={t('salary.taxStatus')} value={salary.taxStatus} onChange={(v: string) => updateField(setSalary, 'taxStatus', v)} helpKey="taxStatus"
                  options={[{ value: 'RESIDENT', label: t('salary.resident') }, { value: 'NON_RESIDENT', label: t('salary.nonResident') }]} />
                <FormInput label={t('salary.grossSalary')} value={salary.grossSalary} type="number" onChange={(v: string) => updateField(setSalary, 'grossSalary', v)} />
                <FormInput label={t('salary.netSalary')} value={salary.netSalary} type="number" onChange={(v: string) => updateField(setSalary, 'netSalary', v)} />
                <FormInput label={t('salary.dailyRate')} value={salary.dailyRate} type="number" onChange={(v: string) => updateField(setSalary, 'dailyRate', v)} />
                <FormInput label={t('salary.hourlyRate')} value={salary.hourlyRate} type="number" onChange={(v: string) => updateField(setSalary, 'hourlyRate', v)} />
                <FormInput label={t('salary.overtimeMultiplier')} value={salary.overtimeMultiplier} type="number" onChange={(v: string) => updateField(setSalary, 'overtimeMultiplier', v)} helpKey="overtime" />
                <FormInput label={t('salary.nightMultiplier')} value={salary.nightMultiplier} type="number" onChange={(v: string) => updateField(setSalary, 'nightMultiplier', v)} />
                <FormInput label={t('salary.holidayMultiplier')} value={salary.holidayMultiplier} type="number" onChange={(v: string) => updateField(setSalary, 'holidayMultiplier', v)} />
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'documents' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{t('document.title')}</span>
                <Button variant="outline"><Upload className="h-4 w-4 mr-1" />{t('document.upload')}</Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">{t('common.noData')}</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-3 text-left">{t('document.type')}</th>
                      <th className="p-3 text-left">{t('document.number')}</th>
                      <th className="p-3 text-left">{t('document.issueDate')}</th>
                      <th className="p-3 text-left">{t('document.expiryDate')}</th>
                      <th className="p-3 text-left">{t('common.status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((doc: any) => (
                      <tr key={doc.id} className="border-t hover:bg-muted/50">
                        <td className="p-3">{getLocalizedName(doc.documentType, localeStore.locale)}</td>
                        <td className="p-3 font-mono text-xs">{doc.documentNo || '-'}</td>
                        <td className="p-3">{doc.issueDate?.slice(0, 10) || '-'}</td>
                        <td className="p-3">{doc.expiryDate?.slice(0, 10) || '-'}</td>
                        <td className="p-3"><Badge variant={doc.status === 'VALID' ? 'success' : doc.status === 'EXPIRED' ? 'destructive' : 'warning'}>{doc.status}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'attendance' && (
          <Card>
            <CardHeader><CardTitle>{t('attendance.title')}</CardTitle></CardHeader>
            <CardContent>
              {attendance.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">{t('common.noData')}</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-3 text-left">{t('common.date')}</th>
                      <th className="p-3 text-left">{t('attendance.type')}</th>
                      <th className="p-3 text-right">{t('attendance.totalHours')}</th>
                      <th className="p-3 text-right">{t('attendance.overtime')}</th>
                      <th className="p-3 text-left">{t('employment.worksite')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.map((r: any) => (
                      <tr key={r.id} className="border-t">
                        <td className="p-3">{r.date?.slice(0, 10)}</td>
                        <td className="p-3"><Badge variant="secondary">{r.attendanceType}</Badge></td>
                        <td className="p-3 text-right font-mono">{Number(r.totalHours)}</td>
                        <td className="p-3 text-right font-mono">{Number(r.overtimeHours)}</td>
                        <td className="p-3">{r.worksite?.name || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'leaves' && (
          <Card>
            <CardHeader><CardTitle>{t('leave.title')}</CardTitle></CardHeader>
            <CardContent>
              {leaves.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">{t('common.noData')}</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-3 text-left">{t('leave.type')}</th>
                      <th className="p-3 text-left">{t('leave.startDate')}</th>
                      <th className="p-3 text-left">{t('leave.endDate')}</th>
                      <th className="p-3 text-right">{t('leave.days')}</th>
                      <th className="p-3 text-left">{t('common.status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaves.map((l: any) => (
                      <tr key={l.id} className="border-t">
                        <td className="p-3">{getLocalizedName(l.leaveType, localeStore.locale)}</td>
                        <td className="p-3">{l.startDate?.slice(0, 10)}</td>
                        <td className="p-3">{l.endDate?.slice(0, 10)}</td>
                        <td className="p-3 text-right">{l.totalDays}</td>
                        <td className="p-3"><Badge variant={l.status === 'APPROVED' ? 'success' : l.status === 'REJECTED' ? 'destructive' : 'warning'}>{l.status}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'assets' && (
          <Card>
            <CardHeader><CardTitle>{t('asset.title')}</CardTitle></CardHeader>
            <CardContent>
              {assets.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">{t('common.noData')}</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-3 text-left">{t('asset.assetNo')}</th>
                      <th className="p-3 text-left">{t('asset.name')}</th>
                      <th className="p-3 text-left">{t('asset.category')}</th>
                      <th className="p-3 text-left">{t('common.status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assets.map((a: any) => (
                      <tr key={a.id} className="border-t">
                        <td className="p-3 font-mono text-xs">{a.assetNo}</td>
                        <td className="p-3">{a.name}</td>
                        <td className="p-3">{getLocalizedName(a.category, localeStore.locale)}</td>
                        <td className="p-3"><Badge variant="secondary">{a.status}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'transfers' && (
          <Card>
            <CardHeader><CardTitle>{t('transfer.title')}</CardTitle></CardHeader>
            <CardContent>
              {transfers.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">{t('common.noData')}</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-3 text-left">{t('common.date')}</th>
                      <th className="p-3 text-left">{t('transfer.from')}</th>
                      <th className="p-3 text-left">{t('transfer.to')}</th>
                      <th className="p-3 text-left">{t('transfer.type')}</th>
                      <th className="p-3 text-left">{t('common.status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transfers.map((tr: any) => (
                      <tr key={tr.id} className="border-t">
                        <td className="p-3">{tr.transferDate?.slice(0, 10)}</td>
                        <td className="p-3">{tr.fromWorksite?.name || '-'}</td>
                        <td className="p-3">{tr.toWorksite?.name || '-'}</td>
                        <td className="p-3">{tr.transferType}</td>
                        <td className="p-3"><Badge variant={tr.status === 'COMPLETED' ? 'success' : 'warning'}>{tr.status}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  )
}
