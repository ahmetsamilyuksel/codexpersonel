'use client'

import { useCallback } from 'react'
import { useLocaleStore } from '@/store/locale-store'
import trCommon from '@/i18n/tr/common.json'
import ruCommon from '@/i18n/ru/common.json'
import enCommon from '@/i18n/en/common.json'

type Locale = 'tr' | 'ru' | 'en'

const translations: Record<Locale, Record<string, unknown>> = {
  tr: trCommon,
  ru: ruCommon,
  en: enCommon,
}

function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const keys = path.split('.')
  let current: unknown = obj
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return path
    }
    current = (current as Record<string, unknown>)[key]
  }
  return typeof current === 'string' ? current : path
}

export function useTranslations() {
  const locale = useLocaleStore((s) => s.locale)

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      let value = getNestedValue(translations[locale] || translations.tr, key)
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          value = value.replace(`{${k}}`, String(v))
        })
      }
      return value
    },
    [locale]
  )

  return { t, locale }
}
