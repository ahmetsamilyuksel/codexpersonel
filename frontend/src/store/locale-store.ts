import { create } from 'zustand'

type Locale = 'tr' | 'ru' | 'en'

interface LocaleState {
  locale: Locale
  setLocale: (locale: Locale) => void
}

export const useLocaleStore = create<LocaleState>((set) => ({
  locale: (typeof window !== 'undefined'
    ? (localStorage.getItem('locale') as Locale) || 'tr'
    : 'tr') as Locale,
  setLocale: (locale: Locale) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('locale', locale)
    }
    set({ locale })
  },
}))

export function getLocalizedName(item: { nameTr?: string; nameRu?: string; nameEn?: string } | null, locale: Locale = 'tr'): string {
  if (!item) return ''
  switch (locale) {
    case 'tr': return item.nameTr || item.nameEn || ''
    case 'ru': return item.nameRu || item.nameEn || ''
    case 'en': return item.nameEn || item.nameTr || ''
    default: return item.nameTr || ''
  }
}

export function getLocalizedLabel(item: { labelTr?: string; labelRu?: string; labelEn?: string } | null, locale: Locale = 'tr'): string {
  if (!item) return ''
  switch (locale) {
    case 'tr': return item.labelTr || item.labelEn || ''
    case 'ru': return item.labelRu || item.labelEn || ''
    case 'en': return item.labelEn || item.labelTr || ''
    default: return item.labelTr || ''
  }
}
