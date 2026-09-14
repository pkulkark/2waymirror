import * as React from 'react'

import { FOCUS_RING } from '@/lib/styles'
import { cn } from '@/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        `border-input placeholder:text-muted-foreground focus-visible:border-moss aria-invalid:ring-destructive/20 aria-invalid:border-destructive flex field-sizing-content min-h-16 w-full rounded-control border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm ${FOCUS_RING}`,
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
