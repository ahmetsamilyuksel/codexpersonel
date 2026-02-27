'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useLocaleStore } from '@/store/locale-store'
import { useThemeStore } from '@/store/theme-store'
import { useTranslations } from '@/hooks/use-translations'
import { Sun, Moon, Globe, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GlobalSearch } from './global-search'
import { useRouter, usePathname } from 'next/navigation'

const localeLabels = { tr: 'Türkçe', ru: 'Русский', en: 'English' } as const
const localeFlags = { tr: '🇹🇷', ru: '🇷🇺', en: '🇬🇧' } as const
type Locale = 'tr' | 'ru' | 'en'

export function Header() {
  const { t, locale } = useTranslations()
  const { setLocale } = useLocaleStore()
  const { theme, toggleTheme } = useThemeStore()
  const router = useRouter()
  const pathname = usePathname()

  const [langOpen, setLangOpen] = useState(false)
  const langRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const changeLocale = (newLocale: Locale) => {
    setLocale(newLocale)
    setLangOpen(false)
    if (pathname) {
      const newPath = pathname.replace(`/${locale}`, `/${newLocale}`)
      router.push(newPath)
    }
  }

  return (
    <header className="sticky top-0 z-30 h-14 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 flex items-center justify-between px-6">
      <div className="flex items-center gap-4 flex-1 mr-4">
        <GlobalSearch />
      </div>

      <div className="flex items-center gap-2">
        {/* Alerts */}
        <Button variant="ghost" size="icon" onClick={() => router.push(`/${locale}/alerts`)}>
          <Bell className="h-4 w-4" />
        </Button>

        {/* Theme toggle */}
        <Button variant="ghost" size="icon" onClick={toggleTheme}>
          {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </Button>

        {/* Language selector */}
        <div className="relative" ref={langRef}>
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setLangOpen(!langOpen)}>
            <Globe className="h-4 w-4" />
            <span className="text-xs">{localeFlags[locale]}</span>
          </Button>
          {langOpen && (
            <div className="absolute right-0 top-full mt-1 bg-card border rounded-md shadow-lg py-1 min-w-[140px] z-50">
              {(Object.entries(localeLabels) as [Locale, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => changeLocale(key)}
                  className={`flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-muted transition-colors cursor-pointer ${
                    locale === key ? 'font-medium text-primary' : ''
                  }`}
                >
                  <span>{localeFlags[key]}</span>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
