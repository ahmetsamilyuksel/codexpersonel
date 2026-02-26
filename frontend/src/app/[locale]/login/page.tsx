'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useAuthStore } from '@/store/auth-store'
import { useLocaleStore } from '@/store/locale-store'
import { useThemeStore } from '@/store/theme-store'
import { useTranslations } from '@/hooks/use-translations'
import { HardHat, Globe, Sun, Moon } from 'lucide-react'

const localeFlags = { tr: '🇹🇷', ru: '🇷🇺', en: '🇬🇧' } as const
type Locale = 'tr' | 'ru' | 'en'

export default function LoginPage() {
  const { t, locale } = useTranslations()
  const { login, isAuthenticated, fetchUser, isLoading } = useAuthStore()
  const { setLocale } = useLocaleStore()
  const { theme, toggleTheme } = useThemeStore()
  const router = useRouter()
  const params = useParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    document.documentElement.setAttribute('data-theme', theme)
    const urlLocale = params?.locale as Locale
    if (urlLocale && ['tr', 'ru', 'en'].includes(urlLocale)) {
      setLocale(urlLocale)
    }
    fetchUser()
  }, [theme, params?.locale, setLocale, fetchUser])

  useEffect(() => {
    if (mounted && !isLoading && isAuthenticated) {
      router.push(`/${locale}/dashboard`)
    }
  }, [mounted, isLoading, isAuthenticated, locale, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      router.push(`/${locale}/dashboard`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('auth.invalidCredentials')
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  if (!mounted) return null

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      {/* Top right controls */}
      <div className="fixed top-4 right-4 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={toggleTheme}>
          {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </Button>
        <div className="flex gap-1">
          {(['tr', 'ru', 'en'] as Locale[]).map((l) => (
            <Button
              key={l}
              variant={locale === l ? 'default' : 'ghost'}
              size="sm"
              onClick={() => {
                setLocale(l)
                router.push(`/${l}/login`)
              }}
            >
              {localeFlags[l]}
            </Button>
          ))}
        </div>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary">
            <HardHat className="h-8 w-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">SAELA</CardTitle>
          <CardDescription>{t('auth.loginSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <Input
              label={t('auth.email')}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="admin@saela.com"
              autoComplete="email"
            />
            <Input
              label={t('auth.password')}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="********"
              autoComplete="current-password"
            />
            <Button type="submit" className="w-full" loading={loading}>
              {t('auth.login')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
