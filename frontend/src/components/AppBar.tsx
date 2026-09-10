import { Briefcase, GitFork, Link as LinkIcon, Mail, type LucideIcon } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

import { cn } from '@/lib/utils'

export interface AppBarLink {
  label: string
  url: string
}

export interface AppBarTab {
  id: string
  label: string
  count: number
  /** A route path, or "#id" for a jump within the current page. */
  to: string
  /** Overrides route matching, for tabs that jump within the current page. */
  active?: boolean
}

export interface AppBarProps {
  /** The candidate name. Omitted on the dead-end and loading states, which show the wordmark. */
  name?: string
  headline?: string
  links?: AppBarLink[]
  /** Outlined chip on the right of the name row, e.g. "0 of 2 required answered". */
  statusChip?: string
  /** Filled chip on the right of the name row, e.g. "Acme Corp, until 15 Sep". */
  sessionChip?: string
  tabs?: AppBarTab[]
}

export const WORDMARK = '2WayMirror'

/**
 * lucide dropped its brand icons, so GitHub and LinkedIn use the closest stroke icons in the
 * set: a fork for GitHub, a briefcase for LinkedIn. Anything else falls back to a link.
 */
function iconForLabel(label: string): LucideIcon {
  const normalized = label.trim().toLowerCase()
  if (normalized.includes('mail') || normalized.includes('email')) return Mail
  if (normalized.includes('github')) return GitFork
  if (normalized.includes('linkedin')) return Briefcase
  return LinkIcon
}

function ProfileLink({ link, icon: Icon }: { link: AppBarLink; icon: LucideIcon }) {
  const external = !link.url.startsWith('mailto:')

  return (
    <a
      href={link.url}
      {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
      className="text-on-dark focus-visible:outline-moss flex items-center gap-[7px] text-[15px] leading-[1.4] font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <Icon aria-hidden="true" strokeWidth={1.4} className="text-on-dark-muted size-4 shrink-0" />
      <span>{link.label}</span>
    </a>
  )
}

/**
 * The dark app bar: identity, status, and section navigation in one sticky block.
 * Measurements come from docs/design/mockups/Screening.dc.html.
 */
export default function AppBar({
  name,
  headline,
  links,
  statusChip,
  sessionChip,
  tabs,
}: AppBarProps) {
  const hasChips = Boolean(statusChip) || Boolean(sessionChip)
  const hasSecondRow = Boolean(headline) || Boolean(links && links.length > 0)
  const hasTabs = Boolean(tabs && tabs.length > 0)
  const { pathname } = useLocation()

  return (
    <header className="bg-dark sticky top-0 z-50">
      <div className="mx-auto flex w-[960px] flex-col">
        <div className="flex h-14 items-center justify-between gap-6">
          <h1 className="text-on-dark font-serif text-[20px] leading-none font-medium">
            {name ?? WORDMARK}
          </h1>
          {hasChips && (
            <div className="flex items-center gap-3">
              {statusChip && (
                <span className="border-dark-border text-on-dark-muted rounded-full border px-3 py-1.5 text-[13px] leading-[1.4] font-semibold">
                  {statusChip}
                </span>
              )}
              {sessionChip && (
                <span className="bg-moss-tint text-moss rounded-full px-3 py-1.5 text-[13px] leading-[1.4] font-semibold">
                  {sessionChip}
                </span>
              )}
            </div>
          )}
        </div>

        {hasSecondRow && (
          <div className="flex flex-col items-start gap-2.5 pb-4">
            {headline && <p className="text-on-dark-muted text-[15px] leading-[1.4]">{headline}</p>}
            {links && links.length > 0 && (
              <nav aria-label="Profile links" className="flex items-center gap-5">
                {links.map((link) => (
                  <ProfileLink key={link.url} link={link} icon={iconForLabel(link.label)} />
                ))}
              </nav>
            )}
          </div>
        )}

        {hasTabs && (
          <nav aria-label="Sections" className="flex h-11 items-stretch gap-8">
            {tabs?.map((tab) => {
              // An explicit flag wins; otherwise the tab is active when its path is the page.
              const active = tab.active ?? pathname === tab.to
              const className = cn(
                'focus-visible:outline-moss flex items-center gap-2 border-b-2 text-[15px] leading-[1.4] font-semibold focus-visible:outline-2 focus-visible:-outline-offset-2',
                active ? 'border-moss text-on-dark' : 'text-on-dark-muted border-transparent',
              )
              const label = (
                <>
                  <span>{tab.label}</span>
                  <span className="bg-dark-input text-on-dark-muted rounded-full px-2 py-0.5 text-[12px] leading-[1.4] font-semibold">
                    {/* The pill shows a bare number; screen readers get the noun with it. */}
                    <span aria-hidden="true">{tab.count}</span>
                    <span className="sr-only">
                      {tab.count} {tab.count === 1 ? 'answer' : 'answers'}
                    </span>
                  </span>
                </>
              )
              // A same-page jump ("#section") stays a native anchor so the browser scrolls;
              // a router link would swallow the click and only rewrite the URL.
              return tab.to.startsWith('#') ? (
                <a
                  key={tab.id}
                  href={tab.to}
                  aria-current={active ? 'page' : undefined}
                  className={className}
                >
                  {label}
                </a>
              ) : (
                <Link
                  key={tab.id}
                  to={tab.to}
                  aria-current={active ? 'page' : undefined}
                  className={className}
                >
                  {label}
                </Link>
              )
            })}
          </nav>
        )}
      </div>
    </header>
  )
}
