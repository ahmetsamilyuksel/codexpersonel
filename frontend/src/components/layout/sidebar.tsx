'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/cn'
import { useTranslations } from '@/hooks/use-translations'
import { useAuthStore } from '@/store/auth-store'
import {
  LayoutDashboard,
  Users,
  Building2,
  Clock,
  Wallet,
  Hammer,
  Package,
  FileText,
  CalendarOff,
  ArrowLeftRight,
  Bell,
  BarChart3,
  Settings,
  UserCog,
  LogOut,
  HardHat,
} from 'lucide-react'

interface NavItem {
  key: string
  icon: React.ElementType
  href: string
  permission?: string
}

const navItems: NavItem[] = [
  { key: 'dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { key: 'employees', icon: Users, href: '/employees', permission: 'employees.view' },
  { key: 'worksites', icon: Building2, href: '/worksites', permission: 'worksites.view' },
  { key: 'attendance', icon: Clock, href: '/attendance', permission: 'attendance.view' },
  { key: 'payroll', icon: Wallet, href: '/payroll', permission: 'payroll.view' },
  { key: 'hakkedis', icon: Hammer, href: '/hakkedis', permission: 'hakkedis.view' },
  { key: 'assets', icon: Package, href: '/assets', permission: 'assets.view' },
  { key: 'documents', icon: FileText, href: '/documents', permission: 'documents.view' },
  { key: 'leaves', icon: CalendarOff, href: '/leaves', permission: 'leaves.view' },
  { key: 'transfers', icon: ArrowLeftRight, href: '/transfers', permission: 'transfers.view' },
  { key: 'alerts', icon: Bell, href: '/alerts' },
  { key: 'reports', icon: BarChart3, href: '/reports', permission: 'reports.view' },
  { key: 'users', icon: UserCog, href: '/users', permission: 'users.view' },
  { key: 'settings', icon: Settings, href: '/settings', permission: 'settings.view' },
]

export function Sidebar() {
  const { t, locale } = useTranslations()
  const pathname = usePathname()
  const { hasPermission, logout, user } = useAuthStore()

  const visibleItems = navItems.filter(
    (item) => !item.permission || hasPermission(item.permission)
  )

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-60 bg-sidebar-bg text-sidebar-fg flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-4 border-b border-sidebar-hover">
        <HardHat className="h-7 w-7 text-sidebar-active" />
        <div>
          <h1 className="text-lg font-bold tracking-tight">SAELA</h1>
          <p className="text-xs text-sidebar-fg/60">{t('app.name')}</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {visibleItems.map((item) => {
          const isActive = pathname?.startsWith(`/${locale}${item.href}`)
          return (
            <Link
              key={item.key}
              href={`/${locale}${item.href}`}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors mb-0.5',
                isActive
                  ? 'bg-sidebar-active text-white font-medium'
                  : 'text-sidebar-fg/80 hover:bg-sidebar-hover hover:text-sidebar-fg'
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{t(`nav.${item.key}`)}</span>
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div className="border-t border-sidebar-hover p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-8 w-8 rounded-full bg-sidebar-active flex items-center justify-center text-xs font-bold text-white">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.firstName} {user?.lastName}</p>
            <p className="text-xs text-sidebar-fg/60 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm text-sidebar-fg/80 hover:bg-sidebar-hover hover:text-sidebar-fg transition-colors cursor-pointer"
        >
          <LogOut className="h-4 w-4" />
          <span>{t('nav.logout')}</span>
        </button>
      </div>
    </aside>
  )
}
