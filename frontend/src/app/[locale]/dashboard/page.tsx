'use client'

import React, { useEffect, useState } from 'react'
import { AppLayout } from '@/components/layout/app-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useTranslations } from '@/hooks/use-translations'
import apiClient from '@/lib/api-client'
import {
  Users,
  Building2,
  AlertTriangle,
  FileWarning,
  Clock,
  Wallet,
  Package,
  TrendingUp,
} from 'lucide-react'

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

export default function DashboardPage() {
  const { t } = useTranslations()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      const { data } = await apiClient.get('/dashboard/stats')
      if (data.success) setStats(data.data)
    } catch {
      // Dashboard stats may not be available yet
    } finally {
      setLoading(false)
    }
  }

  const statCards = [
    { key: 'totalEmployees', icon: Users, value: stats?.totalEmployees || 0, color: 'text-blue-600' },
    { key: 'activeEmployees', icon: Users, value: stats?.activeEmployees || 0, color: 'text-green-600' },
    { key: 'byWorksite', icon: Building2, value: stats?.totalWorksites || 0, color: 'text-purple-600' },
    { key: 'upcomingExpiries', icon: AlertTriangle, value: stats?.criticalAlerts || 0, color: 'text-red-600' },
    { key: 'missingDocuments', icon: FileWarning, value: stats?.missingDocuments || 0, color: 'text-orange-600' },
    { key: 'attendanceGaps', icon: Clock, value: stats?.attendanceGaps || 0, color: 'text-yellow-600' },
    { key: 'monthlyPayroll', icon: Wallet, value: stats?.monthlyPayroll || 0, color: 'text-emerald-600', isCurrency: true },
    { key: 'openAssets', icon: Package, value: stats?.openAssets || 0, color: 'text-cyan-600' },
  ]

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{t('dashboard.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">SAELA {t('app.name')}</p>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((card) => (
            <Card key={card.key}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{t(`dashboard.${card.key}`)}</p>
                    <p className="text-2xl font-bold mt-1">
                      {card.isCurrency
                        ? new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(card.value)
                        : card.value}
                    </p>
                  </div>
                  <card.icon className={`h-8 w-8 ${card.color} opacity-80`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upcoming Expiries */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                {t('dashboard.upcomingExpiries')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats?.upcomingExpiries && stats.upcomingExpiries.length > 0 ? (
                <div className="space-y-3">
                  {stats.upcomingExpiries.slice(0, 10).map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <div>
                        <span className="font-medium">{item.employeeName}</span>
                        <span className="text-muted-foreground ml-2">- {item.documentType}</span>
                      </div>
                      <Badge variant={item.daysLeft <= 7 ? 'destructive' : item.daysLeft <= 30 ? 'warning' : 'secondary'}>
                        {item.daysLeft <= 0 ? t('alert.expired') : `${item.daysLeft} ${t('alert.daysLeft')}`}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm py-4 text-center">{t('common.noData')}</p>
              )}
            </CardContent>
          </Card>

          {/* By Worksite */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                {t('dashboard.byWorksite')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats?.bySite && stats.bySite.length > 0 ? (
                <div className="space-y-3">
                  {stats.bySite.map((site, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span>{site.name}</span>
                      <Badge variant="secondary">{site.count}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm py-4 text-center">{t('common.noData')}</p>
              )}
            </CardContent>
          </Card>

          {/* By Nationality */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                {t('dashboard.byNationality')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats?.byNationality && stats.byNationality.length > 0 ? (
                <div className="space-y-3">
                  {stats.byNationality.map((nat, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span>{nat.name}</span>
                      <Badge variant="secondary">{nat.count}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm py-4 text-center">{t('common.noData')}</p>
              )}
            </CardContent>
          </Card>

          {/* By Work Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                {t('dashboard.byStatus')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats?.byStatus && stats.byStatus.length > 0 ? (
                <div className="space-y-3">
                  {stats.byStatus.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span>{t(`workStatus.${item.status.toLowerCase()}`)}</span>
                      <Badge variant="secondary">{item.count}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm py-4 text-center">{t('common.noData')}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  )
}
