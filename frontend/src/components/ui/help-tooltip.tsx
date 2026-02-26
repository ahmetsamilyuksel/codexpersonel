'use client'

import React, { useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Info, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useTranslations } from '@/hooks/use-translations'

interface HelpTooltipProps {
  helpKey: string
  className?: string
  side?: 'top' | 'right' | 'bottom' | 'left'
}

export function HelpTooltip({ helpKey, className, side = 'right' }: HelpTooltipProps) {
  const { t } = useTranslations()
  const [open, setOpen] = useState(false)
  const helpText = t(`help.${helpKey}`)

  // Don't render if no help text found
  if (helpText === `help.${helpKey}`) return null

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex items-center justify-center h-4 w-4 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer',
            className
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side={side}
          sideOffset={8}
          className="z-50 max-w-xs rounded-lg border bg-card p-3 shadow-lg animate-in fade-in-0 zoom-in-95"
        >
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p className="text-sm text-card-foreground leading-relaxed">{helpText}</p>
            <button
              onClick={() => setOpen(false)}
              className="shrink-0 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <Popover.Arrow className="fill-border" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

interface FormFieldWithHelpProps {
  label: string
  helpKey?: string
  required?: boolean
  children: React.ReactNode
  className?: string
}

export function FormFieldWithHelp({ label, helpKey, required, children, className }: FormFieldWithHelpProps) {
  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-center gap-1.5 mb-1">
        <label className="text-sm font-medium text-foreground">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </label>
        {helpKey && <HelpTooltip helpKey={helpKey} />}
      </div>
      {children}
    </div>
  )
}
