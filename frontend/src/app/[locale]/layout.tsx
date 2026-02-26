'use client'

import { Providers } from '@/components/providers'

export default function LocaleLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <Providers>{children}</Providers>
}
