'use client'

import React, { useState, useCallback } from 'react'
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
  Shield,
  Users,
  Plus,
  Search,
  X,
  Check,
  Key,
} from 'lucide-react'

interface UserRow {
  id: string
  email: string
  firstName: string
  lastName: string
  status: string
  locale: string
  lastLoginAt: string | null
  createdAt: string
  userRoles: {
    id: string
    worksiteId: string | null
    role: {
      id: string
      code: string
      nameTr: string
      nameRu: string
      nameEn: string
    }
  }[]
}

interface RoleRow {
  id: string
  code: string
  nameTr: string
  nameRu: string
  nameEn: string
  description: string | null
  isSystem: boolean
  siteScoped: boolean
  _count: {
    rolePermissions: number
    userRoles: number
  }
}

export default function UsersPage() {
  const { t, locale } = useTranslations()
  const { locale: currentLocale } = useLocaleStore()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users')

  // ========== Users State ==========
  const [userPage, setUserPage] = useState(1)
  const [userSearch, setUserSearch] = useState('')
  const [userSearchInput, setUserSearchInput] = useState('')
  const [userStatusFilter, setUserStatusFilter] = useState('')
  const [showAddUser, setShowAddUser] = useState(false)
  const [newUser, setNewUser] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    roleIds: [] as string[],
  })
  const [userFormError, setUserFormError] = useState('')
  const userLimit = 25

  // ========== Roles State ==========
  const [showAddRole, setShowAddRole] = useState(false)
  const [newRole, setNewRole] = useState({
    code: '',
    nameTr: '',
    nameRu: '',
    nameEn: '',
    description: '',
    siteScoped: false,
  })
  const [roleFormError, setRoleFormError] = useState('')

  // ========== Queries ==========
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['users', userPage, userSearch, userStatusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(userPage),
        limit: String(userLimit),
      })
      if (userSearch) params.set('search', userSearch)
      if (userStatusFilter) params.set('status', userStatusFilter)
      const res = await apiClient.get(`/users?${params}`)
      return res.data
    },
    enabled: activeTab === 'users',
  })

  const { data: rolesData, isLoading: rolesLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const res = await apiClient.get('/roles')
      return res.data
    },
  })

  // ========== Mutations ==========
  const createUserMutation = useMutation({
    mutationFn: (payload: typeof newUser) => apiClient.post('/users', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setShowAddUser(false)
      setNewUser({ firstName: '', lastName: '', email: '', password: '', roleIds: [] })
      setUserFormError('')
    },
    onError: (err: any) => {
      setUserFormError(err.response?.data?.error || 'Failed to create user')
    },
  })

  const createRoleMutation = useMutation({
    mutationFn: (payload: typeof newRole) => apiClient.post('/roles', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      setShowAddRole(false)
      setNewRole({ code: '', nameTr: '', nameRu: '', nameEn: '', description: '', siteScoped: false })
      setRoleFormError('')
    },
    onError: (err: any) => {
      setRoleFormError(err.response?.data?.error || 'Failed to create role')
    },
  })

  const handleUserSearch = useCallback(() => {
    setUserSearch(userSearchInput)
    setUserPage(1)
  }, [userSearchInput])

  const roles: RoleRow[] = rolesData?.data || []

  const toggleRoleSelection = (roleId: string) => {
    setNewUser((prev) => {
      const roleIds = prev.roleIds.includes(roleId)
        ? prev.roleIds.filter((id) => id !== roleId)
        : [...prev.roleIds, roleId]
      return { ...prev, roleIds }
    })
  }

  // ========== User Columns ==========
  const userColumns: Column<UserRow>[] = [
    {
      key: 'name',
      header: t('common.name'),
      render: (item) => (
        <div>
          <span className="font-medium">
            {item.firstName} {item.lastName}
          </span>
        </div>
      ),
    },
    {
      key: 'email',
      header: t('user.email') || 'Email',
      render: (item) => (
        <span className="text-sm">{item.email}</span>
      ),
    },
    {
      key: 'roles',
      header: t('user.roles') || 'Roles',
      render: (item) => (
        <div className="flex flex-wrap gap-1">
          {item.userRoles.map((ur) => (
            <Badge key={ur.id} variant="secondary" className="text-xs">
              {getLocalizedName(ur.role, currentLocale)}
            </Badge>
          ))}
          {item.userRoles.length === 0 && (
            <span className="text-xs text-muted-foreground">-</span>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (item) => {
        const variants: Record<string, 'success' | 'destructive' | 'secondary'> = {
          ACTIVE: 'success',
          INACTIVE: 'secondary',
          SUSPENDED: 'destructive',
        }
        return (
          <Badge variant={variants[item.status] || 'secondary'}>
            {t(`common.${item.status.toLowerCase()}`) || item.status}
          </Badge>
        )
      },
    },
    {
      key: 'lastLogin',
      header: t('user.lastLogin') || 'Last Login',
      render: (item) =>
        item.lastLoginAt
          ? new Date(item.lastLoginAt).toLocaleString()
          : <span className="text-muted-foreground">-</span>,
    },
    {
      key: 'createdAt',
      header: t('common.createdAt') || 'Created',
      render: (item) => new Date(item.createdAt).toLocaleDateString(),
    },
  ]

  // ========== Role Columns ==========
  const roleColumns: Column<RoleRow>[] = [
    {
      key: 'code',
      header: t('role.code') || 'Code',
      render: (item) => (
        <span className="font-mono text-xs font-medium">{item.code}</span>
      ),
    },
    {
      key: 'name',
      header: t('common.name'),
      render: (item) => (
        <span className="font-medium">{getLocalizedName(item, currentLocale)}</span>
      ),
    },
    {
      key: 'description',
      header: t('common.description') || 'Description',
      render: (item) => (
        <span className="text-sm text-muted-foreground truncate max-w-[250px] block">
          {item.description || '-'}
        </span>
      ),
    },
    {
      key: 'permissions',
      header: t('role.permissions') || 'Permissions',
      render: (item) => (
        <Badge variant="secondary">
          <Key className="h-3 w-3 mr-1" />
          {item._count.rolePermissions}
        </Badge>
      ),
    },
    {
      key: 'users',
      header: t('user.title') || 'Users',
      render: (item) => (
        <Badge variant="secondary">
          <Users className="h-3 w-3 mr-1" />
          {item._count.userRoles}
        </Badge>
      ),
    },
    {
      key: 'type',
      header: t('role.type') || 'Type',
      render: (item) => (
        <div className="flex items-center gap-1">
          {item.isSystem && (
            <Badge variant="default" className="text-xs">
              {t('role.system') || 'System'}
            </Badge>
          )}
          {item.siteScoped && (
            <Badge variant="warning" className="text-xs">
              {t('role.siteScoped') || 'Site Scoped'}
            </Badge>
          )}
          {!item.isSystem && !item.siteScoped && (
            <span className="text-xs text-muted-foreground">
              {t('role.custom') || 'Custom'}
            </span>
          )}
        </div>
      ),
    },
  ]

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">
              {t('user.management') || 'Users & Roles'}
            </h1>
            <HelpTooltip helpKey="users" />
          </div>
          <div className="flex items-center gap-2">
            {activeTab === 'users' && (
              <Button onClick={() => setShowAddUser(true)}>
                <Plus className="h-4 w-4 mr-1" />
                {t('user.addNew') || 'New User'}
              </Button>
            )}
            {activeTab === 'roles' && (
              <Button onClick={() => setShowAddRole(true)}>
                <Plus className="h-4 w-4 mr-1" />
                {t('role.addNew') || 'New Role'}
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b">
          <button
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'users'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('users')}
          >
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              {t('user.title') || 'Users'}
            </div>
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'roles'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('roles')}
          >
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              {t('role.title') || 'Roles'}
              {roles.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {roles.length}
                </Badge>
              )}
            </div>
          </button>
        </div>

        {/* ========== Users Tab ========== */}
        {activeTab === 'users' && (
          <>
            {/* Filters */}
            <Card>
              <CardContent className="pt-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-md">
                    <Input
                      placeholder={t('common.search') + '...'}
                      value={userSearchInput}
                      onChange={(e) => setUserSearchInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleUserSearch()}
                    />
                    <Button variant="outline" size="icon" onClick={handleUserSearch}>
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                  <select
                    className="h-9 rounded-md border border-input bg-card px-3 text-sm"
                    value={userStatusFilter}
                    onChange={(e) => { setUserStatusFilter(e.target.value); setUserPage(1) }}
                  >
                    <option value="">{t('common.all')} {t('common.status')}</option>
                    <option value="ACTIVE">{t('common.active')}</option>
                    <option value="INACTIVE">{t('common.inactive')}</option>
                    <option value="SUSPENDED">{t('user.suspended') || 'Suspended'}</option>
                  </select>
                  {usersData?.pagination && (
                    <div className="ml-auto text-sm text-muted-foreground">
                      {t('common.total')}: <span className="font-medium">{usersData.pagination.total}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Add User Form */}
            {showAddUser && (
              <Card className="border-primary/30">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {t('user.addNew') || 'New User'}
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => { setShowAddUser(false); setUserFormError('') }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {userFormError && (
                    <div className="mb-3 rounded-md bg-destructive/10 p-2 text-sm text-destructive">
                      {userFormError}
                    </div>
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Input
                      label={t('employee.firstName') || 'First Name'}
                      value={newUser.firstName}
                      onChange={(e) => setNewUser((p) => ({ ...p, firstName: e.target.value }))}
                      required
                    />
                    <Input
                      label={t('employee.lastName') || 'Last Name'}
                      value={newUser.lastName}
                      onChange={(e) => setNewUser((p) => ({ ...p, lastName: e.target.value }))}
                      required
                    />
                    <Input
                      label={t('user.email') || 'Email'}
                      type="email"
                      value={newUser.email}
                      onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))}
                      required
                    />
                    <Input
                      label={t('user.password') || 'Password'}
                      type="password"
                      value={newUser.password}
                      onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))}
                      required
                    />
                  </div>
                  {/* Role Selection */}
                  <div className="mt-3">
                    <label className="block text-sm font-medium mb-2">
                      {t('user.roles') || 'Roles'}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {roles.map((role) => (
                        <button
                          key={role.id}
                          type="button"
                          className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                            newUser.roleIds.includes(role.id)
                              ? 'border-primary bg-primary/10 text-primary font-medium'
                              : 'border-input bg-card text-muted-foreground hover:text-foreground hover:border-primary/50'
                          }`}
                          onClick={() => toggleRoleSelection(role.id)}
                        >
                          {getLocalizedName(role, currentLocale)}
                        </button>
                      ))}
                      {roles.length === 0 && (
                        <span className="text-sm text-muted-foreground">
                          {t('common.noData')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <Button
                      onClick={() => createUserMutation.mutate(newUser)}
                      loading={createUserMutation.isPending}
                      disabled={!newUser.email || !newUser.password || !newUser.firstName || !newUser.lastName}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      {t('common.save')}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => { setShowAddUser(false); setUserFormError('') }}
                    >
                      {t('common.cancel')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Users Table */}
            <DataTable
              columns={userColumns}
              data={usersData?.data || []}
              pagination={usersData?.pagination}
              onPageChange={setUserPage}
              loading={usersLoading}
              emptyMessage={t('common.noData')}
            />
          </>
        )}

        {/* ========== Roles Tab ========== */}
        {activeTab === 'roles' && (
          <>
            {/* Add Role Form */}
            {showAddRole && (
              <Card className="border-primary/30">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {t('role.addNew') || 'New Role'}
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => { setShowAddRole(false); setRoleFormError('') }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {roleFormError && (
                    <div className="mb-3 rounded-md bg-destructive/10 p-2 text-sm text-destructive">
                      {roleFormError}
                    </div>
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                    <Input
                      label={t('role.code') || 'Code'}
                      value={newRole.code}
                      onChange={(e) =>
                        setNewRole((p) => ({ ...p, code: e.target.value.toUpperCase() }))
                      }
                      placeholder="ROLE_CODE"
                      required
                    />
                    <Input
                      label={`${t('common.name')} (TR)`}
                      value={newRole.nameTr}
                      onChange={(e) =>
                        setNewRole((p) => ({ ...p, nameTr: e.target.value }))
                      }
                      required
                    />
                    <Input
                      label={`${t('common.name')} (RU)`}
                      value={newRole.nameRu}
                      onChange={(e) =>
                        setNewRole((p) => ({ ...p, nameRu: e.target.value }))
                      }
                      required
                    />
                    <Input
                      label={`${t('common.name')} (EN)`}
                      value={newRole.nameEn}
                      onChange={(e) =>
                        setNewRole((p) => ({ ...p, nameEn: e.target.value }))
                      }
                      required
                    />
                    <Input
                      label={t('common.description') || 'Description'}
                      value={newRole.description}
                      onChange={(e) =>
                        setNewRole((p) => ({ ...p, description: e.target.value }))
                      }
                    />
                  </div>
                  <div className="flex items-center gap-3 mt-3">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={newRole.siteScoped}
                        onChange={(e) =>
                          setNewRole((p) => ({ ...p, siteScoped: e.target.checked }))
                        }
                        className="rounded border-input"
                      />
                      {t('role.siteScoped') || 'Site Scoped'}
                    </label>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <Button
                      onClick={() => createRoleMutation.mutate(newRole)}
                      loading={createRoleMutation.isPending}
                      disabled={!newRole.code || !newRole.nameTr || !newRole.nameRu || !newRole.nameEn}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      {t('common.save')}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => { setShowAddRole(false); setRoleFormError('') }}
                    >
                      {t('common.cancel')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Roles Table */}
            <DataTable
              columns={roleColumns}
              data={roles}
              loading={rolesLoading}
              emptyMessage={t('common.noData')}
            />
          </>
        )}
      </div>
    </AppLayout>
  )
}
