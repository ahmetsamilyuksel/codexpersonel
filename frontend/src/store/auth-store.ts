import { create } from 'zustand'
import apiClient from '@/lib/api-client'

interface UserRole {
  id: string
  code: string
  nameTr: string
  nameRu: string
  nameEn: string
}

interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  locale: string
  theme: string
  status: string
  roles: UserRole[]
  permissions: string[]
}

interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  fetchUser: () => Promise<void>
  hasPermission: (permission: string) => boolean
  hasAnyPermission: (permissions: string[]) => boolean
  hasRole: (roleCode: string) => boolean
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (email: string, password: string) => {
    const { data } = await apiClient.post('/auth/login', { email, password })
    if (data.success) {
      localStorage.setItem('accessToken', data.data.accessToken)
      set({ user: data.data.user, isAuthenticated: true, isLoading: false })
    } else {
      throw new Error(data.error || 'Login failed')
    }
  },

  logout: () => {
    localStorage.removeItem('accessToken')
    set({ user: null, isAuthenticated: false, isLoading: false })
    window.location.href = '/tr/login'
  },

  fetchUser: async () => {
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) {
        set({ user: null, isAuthenticated: false, isLoading: false })
        return
      }
      const { data } = await apiClient.get('/auth/me')
      if (data.success) {
        set({ user: data.data, isAuthenticated: true, isLoading: false })
      } else {
        set({ user: null, isAuthenticated: false, isLoading: false })
      }
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false })
    }
  },

  hasPermission: (permission: string) => {
    const { user } = get()
    if (!user) return false
    if (user.roles.some((r) => r.code === 'SUPER_ADMIN')) return true
    return user.permissions.includes(permission)
  },

  hasAnyPermission: (permissions: string[]) => {
    const { user } = get()
    if (!user) return false
    if (user.roles.some((r) => r.code === 'SUPER_ADMIN')) return true
    return permissions.some((p) => user.permissions.includes(p))
  },

  hasRole: (roleCode: string) => {
    const { user } = get()
    if (!user) return false
    return user.roles.some((r) => r.code === roleCode)
  },
}))
