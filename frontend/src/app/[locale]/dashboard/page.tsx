'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useTranslations } from '@/hooks/use-translations'
import apiClient from '@/lib/api-client'
import {
  Users, Building2, AlertTriangle, FileWarning, Clock, Wallet,
  Package, TrendingUp, UserCheck, UserX, Globe, Briefcase,
  ArrowRight, Shield, CalendarDays, Activity,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area, RadialBarChart, RadialBar,
} from 'recharts'

interface DashboardStats {
  totalEmployees: number
  activeEmployees: number
  totalWorksites: number
  criticalAlerts: number
  warningAlerts: number
  missingDocuments: number
  attendanceGaps: number
  openAssets: number
  monthlyPayroll: number
  bySite: { name: string; count: number }[]
  byStatus: { status: string; count: number }[]
  byNationality: { name: string; count: number }[]
  upcomingExpiries: { employeeName: string; documentType: string; expiryDate: string; daysLeft: number }[]
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316', '#14b8a6', '#6366f1']
const STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#10b981', INACTIVE: '#94a3b8', TERMINATED: '#ef4444', ON_LEAVE: '#f59e0b',
}

export default function DashboardPage() {
  const { t, locale } = useTranslations()
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [seedLoading, setSeedLoading] = useState(false)
  const [seedError, setSeedError] = useState<string | null>(null)
  const [seedSuccess, setSeedSuccess] = useState<string | null>(null)

  useEffect(() => { loadStats() }, [])

  const loadStats = async () => {
    try {
      const { data } = await apiClient.get('/dashboard/stats')
      if (data.success) setStats(data.data)
    } catch (e) {
      console.error('Dashboard stats error:', e)
    } finally { setLoading(false) }
  }

  const handleSeedDemo = async () => {
    setSeedLoading(true)
    setSeedError(null)
    setSeedSuccess(null)
    try {
      const { data } = await apiClient.post('/seed-demo')
      if (data.success) {
        setSeedSuccess(`${data.data?.counts?.employees || 150} çalışan başarıyla oluşturuldu!`)
        await loadStats()
      } else {
        setSeedError(data.error || 'Bilinmeyen hata')
      }
    } catch (e: any) {
      const msg = e.response?.data?.error || e.message || 'Bağlantı hatası'
      setSeedError(`Demo verisi yüklenemedi: ${msg}`)
      console.error('Seed error:', e)
    } finally { setSeedLoading(false) }
  }

  const fmtCurrency = (v: number) =>
    new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(v)

  const totalEmps = stats?.totalEmployees || 0
  const activeEmps = stats?.activeEmployees || 0
  const inactiveEmps = totalEmps - activeEmps

  // Pie data for employee status
  const statusData = stats?.byStatus?.map(s => ({
    name: t(`common.${s.status.toLowerCase()}`),
    value: s.count,
    fill: STATUS_COLORS[s.status] || '#94a3b8',
  })) || []

  // Bar data for worksites
  const siteData = stats?.bySite?.map(s => ({
    name: s.name.length > 20 ? s.name.slice(0, 18) + '...' : s.name,
    count: s.count,
  })) || []

  // Nationality data for pie
  const natData = stats?.byNationality?.map((n, i) => ({
    name: n.name,
    value: n.count,
    fill: COLORS[i % COLORS.length],
  })) || []

  // Radial bar for key metrics
  const gaugeData = [
    { name: t('dashboard.activeEmployees'), value: activeEmps, fill: '#10b981' },
    { name: t('dashboard.totalEmployees'), value: totalEmps, fill: '#3b82f6' },
  ]

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t('dashboard.title')}</h1>
            <p className="text-muted-foreground text-sm mt-1">SAELA {t('app.name')}</p>
          </div>
          <Button onClick={handleSeedDemo} loading={seedLoading} variant="default" disabled={seedLoading}>
            <Activity className="h-4 w-4 mr-2" />
            {seedLoading ? 'Yükleniyor...' : totalEmps === 0 ? 'Demo Veri Yükle (150 Çalışan)' : 'Demo Veriyi Yenile'}
          </Button>
        </div>

        {/* Seed feedback */}
        {seedError && (
          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-300 text-sm">
            <strong>Hata:</strong> {seedError}
          </div>
        )}
        {seedSuccess && (
          <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4 text-green-700 dark:text-green-300 text-sm">
            {seedSuccess}
          </div>
        )}

        {/* KPI Cards - 2 rows */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="cursor-pointer hover:border-blue-500/50" onClick={() => router.push(`/${locale}/employees`)}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{t('dashboard.totalEmployees')}</p>
                  <p className="text-3xl font-bold text-blue-600">{totalEmps}</p>
                </div>
                <Users className="h-10 w-10 text-blue-600 opacity-60" />
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-green-500/50" onClick={() => router.push(`/${locale}/employees`)}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{t('dashboard.activeEmployees')}</p>
                  <p className="text-3xl font-bold text-green-600">{activeEmps}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {totalEmps > 0 ? `${Math.round(activeEmps / totalEmps * 100)}%` : '0%'}
                  </p>
                </div>
                <UserCheck className="h-10 w-10 text-green-600 opacity-60" />
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-purple-500/50" onClick={() => router.push(`/${locale}/worksites`)}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{t('dashboard.byWorksite')}</p>
                  <p className="text-3xl font-bold text-purple-600">{stats?.totalWorksites || 0}</p>
                </div>
                <Building2 className="h-10 w-10 text-purple-600 opacity-60" />
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-emerald-500/50" onClick={() => router.push(`/${locale}/payroll`)}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{t('dashboard.monthlyPayroll')}</p>
                  <p className="text-xl font-bold text-emerald-600">{fmtCurrency(stats?.monthlyPayroll || 0)}</p>
                </div>
                <Wallet className="h-10 w-10 text-emerald-600 opacity-60" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Alert Cards Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="cursor-pointer hover:border-red-500/50 border-l-4 border-l-red-500" onClick={() => router.push(`/${locale}/alerts`)}>
            <CardContent className="pt-3 pb-3">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-6 w-6 text-red-500" />
                <div>
                  <p className="text-xs text-muted-foreground">{t('alert.critical')}</p>
                  <p className="text-xl font-bold text-red-600">{stats?.criticalAlerts || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-orange-500/50 border-l-4 border-l-orange-500" onClick={() => router.push(`/${locale}/alerts`)}>
            <CardContent className="pt-3 pb-3">
              <div className="flex items-center gap-3">
                <FileWarning className="h-6 w-6 text-orange-500" />
                <div>
                  <p className="text-xs text-muted-foreground">{t('dashboard.missingDocuments')}</p>
                  <p className="text-xl font-bold text-orange-600">{stats?.missingDocuments || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-yellow-500/50 border-l-4 border-l-yellow-500" onClick={() => router.push(`/${locale}/attendance`)}>
            <CardContent className="pt-3 pb-3">
              <div className="flex items-center gap-3">
                <Clock className="h-6 w-6 text-yellow-500" />
                <div>
                  <p className="text-xs text-muted-foreground">{t('dashboard.attendanceGaps')}</p>
                  <p className="text-xl font-bold text-yellow-600">{stats?.attendanceGaps || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-cyan-500/50 border-l-4 border-l-cyan-500" onClick={() => router.push(`/${locale}/assets`)}>
            <CardContent className="pt-3 pb-3">
              <div className="flex items-center gap-3">
                <Package className="h-6 w-6 text-cyan-500" />
                <div>
                  <p className="text-xs text-muted-foreground">{t('dashboard.openAssets')}</p>
                  <p className="text-xl font-bold text-cyan-600">{stats?.openAssets || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Employee Status Pie */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                {t('dashboard.byStatus')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statusData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {statusData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-muted-foreground py-12">{t('common.noData')}</p>
              )}
            </CardContent>
          </Card>

          {/* Nationality Pie */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" />
                {t('dashboard.byNationality')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {natData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={natData}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {natData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-muted-foreground py-12">{t('common.noData')}</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Worksite Bar Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                {t('dashboard.byWorksite')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {siteData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={siteData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-muted-foreground py-12">{t('common.noData')}</p>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Expiries */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                {t('dashboard.upcomingExpiries')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats?.upcomingExpiries && stats.upcomingExpiries.length > 0 ? (
                <div className="space-y-2 max-h-[260px] overflow-y-auto">
                  {stats.upcomingExpiries.slice(0, 15).map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                      <div className="min-w-0 flex-1">
                        <span className="font-medium">{item.employeeName}</span>
                        <span className="text-muted-foreground ml-1 text-xs">- {item.documentType}</span>
                      </div>
                      <Badge variant={item.daysLeft <= 0 ? 'destructive' : item.daysLeft <= 7 ? 'destructive' : item.daysLeft <= 30 ? 'warning' : 'secondary'} className="ml-2 shrink-0">
                        {item.daysLeft <= 0 ? t('alert.expired') : `${item.daysLeft} ${t('alert.daysLeft')}`}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-12">{t('common.noData')}</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('dashboard.quickActions')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {[
                { icon: Users, label: t('employee.addNew'), path: `/${locale}/employees`, color: 'text-blue-600' },
                { icon: Clock, label: t('attendance.title'), path: `/${locale}/attendance`, color: 'text-green-600' },
                { icon: Wallet, label: t('payroll.title'), path: `/${locale}/payroll`, color: 'text-emerald-600' },
                { icon: FileWarning, label: t('document.title'), path: `/${locale}/documents`, color: 'text-orange-600' },
                { icon: CalendarDays, label: t('leave.title'), path: `/${locale}/leaves`, color: 'text-purple-600' },
                { icon: Shield, label: t('report.title'), path: `/${locale}/reports`, color: 'text-cyan-600' },
              ].map((action) => (
                <Button
                  key={action.path}
                  variant="outline"
                  className="h-auto py-3 flex-col gap-2"
                  onClick={() => router.push(action.path)}
                >
                  <action.icon className={`h-5 w-5 ${action.color}`} />
                  <span className="text-xs">{action.label}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
