import type { ReactNode } from 'react'

import AppBar from '@/components/AppBar'
import Page from '@/components/Page'

export interface DeadEndProps {
  /** The candidate name for the app bar. Omitted, the bar shows the wordmark. */
  name?: string
  title: string
  /** The message under the title. */
  children: ReactNode
  /** An optional button under the message, e.g. "Email Jordan Sample" or "Try again". */
  action?: ReactNode
}

/**
 * A dead end: the page with no session behind it. One centered card carries the title, the
 * message, and at most one way out; the app bar keeps its fill but drops the chips and tabs,
 * which have nothing to point at.
 *
 * Measurements come from docs/design/mockups/Expired.dc.html and NotFound.dc.html. The card is
 * plain markup rather than a Surface: there is no header row to toggle and nothing to collapse.
 */
export default function DeadEnd({ name, title, children, action }: DeadEndProps) {
  return (
    <Page appBar={<AppBar name={name} />}>
      <div className="border-surface-border bg-surface mx-auto mt-[72px] flex w-[560px] flex-col items-start rounded-lg border p-12">
        <h2 className="text-ink font-serif text-[28px] leading-[1.2] font-medium">{title}</h2>
        <p className="text-ink mt-4 font-serif text-[17px] leading-[1.6]">{children}</p>
        {action && <div className="mt-6">{action}</div>}
      </div>
    </Page>
  )
}
