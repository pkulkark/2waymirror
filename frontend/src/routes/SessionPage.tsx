import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { Code, FileText, MapPin, MessagesSquare, User, type LucideIcon } from 'lucide-react'

import {
  fetchSession,
  submitAnswers,
  type CompanyQuestion,
  type Content,
  type Evidence,
  type Logistics,
  type Session,
} from '@/api'
import AppBar, { type AppBarTab } from '@/components/AppBar'
import Page from '@/components/Page'
import Surface from '@/components/Surface'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'

type PageState =
  | { status: 'loading' }
  | { status: 'not_found' }
  | { status: 'expired' }
  | { status: 'error'; detail: string }
  | { status: 'live'; session: Session; content: Content }
  | { status: 'submitted'; session: Session; content: Content }
  | { status: 'already_submitted'; session: Session; content: Content }

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

const LONG_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

/** "15 Sep" for the session chip, "10 September" for the sent chip. Dates are read in UTC. */
function formatDate(iso: string, months: string[]): string {
  const date = new Date(iso)
  return `${date.getUTCDate()} ${months[date.getUTCMonth()]}`
}

function pluralize(count: number, noun: string): string {
  return `${count} ${count === 1 ? noun : `${noun}s`}`
}

/**
 * Section icons in content order, per design-system.md: speech bubbles for the initial
 * conversation, a person outline for behavioral, code brackets for the deep dive. Any further
 * section falls back to a document.
 */
const SECTION_ICONS: LucideIcon[] = [MessagesSquare, User, Code]

function sectionIcon(index: number): LucideIcon {
  return SECTION_ICONS[index] ?? FileText
}

function WordmarkPage({ children }: { children: ReactNode }) {
  return <Page appBar={<AppBar />}>{children}</Page>
}

function LoadingSkeleton() {
  return (
    <WordmarkPage>
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </WordmarkPage>
  )
}

function NotFoundState() {
  return (
    <WordmarkPage>
      <Alert variant="destructive">
        <AlertTitle>Session not found</AlertTitle>
        <AlertDescription>
          This link doesn&apos;t match any session. Double check the URL, or ask for a new link.
        </AlertDescription>
      </Alert>
    </WordmarkPage>
  )
}

function ExpiredState() {
  return (
    <WordmarkPage>
      <Alert variant="destructive">
        <AlertTitle>Session expired</AlertTitle>
        <AlertDescription>
          This link is no longer active. Ask for a new one if you still need access.
        </AlertDescription>
      </Alert>
    </WordmarkPage>
  )
}

function ErrorState({ detail }: { detail: string }) {
  return (
    <WordmarkPage>
      <Alert variant="destructive">
        <AlertTitle>Something went wrong</AlertTitle>
        <AlertDescription>{detail}</AlertDescription>
      </Alert>
    </WordmarkPage>
  )
}

function LogisticsList({ logistics }: { logistics: Logistics }) {
  if (logistics.length === 0) return null

  return (
    <dl className="flex flex-col">
      {logistics.map((item) => (
        <div
          key={item.label}
          className="border-hairline flex flex-col gap-1 border-t py-3.5 first:border-t-0"
        >
          <dt className="text-muted-ink text-[13px] leading-[1.4] font-semibold">{item.label}</dt>
          <dd className="text-ink font-serif text-[17px] leading-[1.4]">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

const EVIDENCE_TYPE_LABELS: Record<NonNullable<Evidence['type']>, string> = {
  repo: 'Repo',
  pr: 'PR',
  talk: 'Talk',
  writeup: 'Writeup',
  other: 'Other',
}

function SectionItems({ section }: { section: Content['sections'][number] }) {
  return (
    <div className="flex flex-col gap-6">
      {section.items.map((item) => (
        <div key={item.id}>
          <h3 className="font-medium">{item.question}</h3>
          {item.summary && <p className="text-muted-foreground mt-1 text-sm">{item.summary}</p>}
          <div className="prose prose-sm mt-2 max-w-none text-sm leading-relaxed">
            <ReactMarkdown>{item.answer_md}</ReactMarkdown>
          </div>
          {item.evidence.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2">
              {item.evidence.map((ev) => (
                <li key={ev.url}>
                  <a
                    href={ev.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary text-xs underline underline-offset-2"
                  >
                    {ev.type && (
                      <span className="text-muted-foreground">
                        {EVIDENCE_TYPE_LABELS[ev.type]}:{' '}
                      </span>
                    )}
                    {ev.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}

interface CompanyQuestionsFormProps {
  token: string
  questions: CompanyQuestion[]
  /** Called with the timestamp the API recorded for the submission. */
  onSubmitted: (submittedAt: string) => void
  onAlreadySubmitted: () => void
  /** Called with the number of required questions that have a non-blank answer. */
  onProgress?: (answeredRequired: number) => void
}

function CompanyQuestionsForm({
  token,
  questions,
  onSubmitted,
  onAlreadySubmitted,
  onProgress,
}: CompanyQuestionsFormProps) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const handleChange = (id: string, value: string) => {
    const next = { ...values, [id]: value }
    setValues(next)
    onProgress?.(questions.filter((q) => q.required && next[q.id]?.trim()).length)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)
    setFieldErrors({})

    const missing = questions.filter((q) => q.required && !values[q.id]?.trim())
    if (missing.length > 0) {
      setFieldErrors(
        Object.fromEntries(missing.map((q) => [q.id, 'This question requires an answer.'])),
      )
      return
    }

    const answers = Object.fromEntries(
      Object.entries(values).filter(([, value]) => value.trim().length > 0),
    )

    setSubmitting(true)
    const result = await submitAnswers(token, answers)
    setSubmitting(false)

    if (result.kind === 'ok') {
      onSubmitted(result.data.submitted_at)
      return
    }
    if (result.kind === 'already_submitted') {
      onAlreadySubmitted()
      return
    }
    if (result.kind === 'invalid') {
      const matched = questions.find((q) => result.detail.includes(q.id))
      if (matched) {
        setFieldErrors({ [matched.id]: result.detail })
      } else {
        setFormError(result.detail)
      }
      return
    }
    if (result.kind === 'not_found' || result.kind === 'expired') {
      setFormError('This session is no longer available. Refresh the page for the latest state.')
      return
    }
    setFormError(result.detail)
  }

  return (
    <form onSubmit={handleSubmit} className="text-on-dark flex flex-col gap-5" noValidate>
      {formError && (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}
      {questions.map((q) => (
        <div key={q.id} className="flex flex-col gap-1.5">
          <label htmlFor={`question-${q.id}`} className="text-sm font-medium">
            {q.question}
            {q.required && <span className="text-danger-on-dark ml-1">*</span>}
          </label>
          <Textarea
            id={`question-${q.id}`}
            aria-invalid={Boolean(fieldErrors[q.id])}
            value={values[q.id] ?? ''}
            onChange={(e) => handleChange(q.id, e.target.value)}
          />
          {fieldErrors[q.id] && <p className="text-danger-on-dark text-xs">{fieldErrors[q.id]}</p>}
        </div>
      ))}
      <Button type="submit" disabled={submitting} className="w-fit">
        {submitting ? 'Submitting...' : 'Submit answers'}
      </Button>
    </form>
  )
}

export default function SessionPage() {
  const { token } = useParams<{ token: string }>()
  const [state, setState] = useState<PageState>({ status: 'loading' })
  const [answeredRequired, setAnsweredRequired] = useState(0)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    setState({ status: 'loading' })

    fetchSession(token).then((result) => {
      if (cancelled) return
      if (result.kind === 'ok') {
        setState({
          status: result.data.session.answers_submitted ? 'already_submitted' : 'live',
          session: result.data.session,
          content: result.data.content,
        })
      } else if (result.kind === 'not_found') {
        setState({ status: 'not_found' })
      } else if (result.kind === 'expired') {
        setState({ status: 'expired' })
      } else {
        setState({ status: 'error', detail: result.detail })
      }
    })

    return () => {
      cancelled = true
    }
  }, [token])

  if (!token) return <NotFoundState />
  if (state.status === 'loading') return <LoadingSkeleton />
  if (state.status === 'not_found') return <NotFoundState />
  if (state.status === 'expired') return <ExpiredState />
  if (state.status === 'error') return <ErrorState detail={state.detail} />

  const { session, content } = state

  const sent = state.status !== 'live'
  const requiredCount = content.company_questions.filter((q) => q.required).length
  const statusChip = sent
    ? `Sent ${formatDate(session.submitted_at ?? new Date().toISOString(), LONG_MONTHS)}`
    : `${answeredRequired} of ${requiredCount} required answered`
  const sessionChip = `${session.company}, until ${formatDate(session.expires_at, SHORT_MONTHS)}`

  // Until #107 adds a route per section, every tab stays on this page: the first is the
  // page itself and the rest jump to their surface.
  const tabs: AppBarTab[] = content.sections.map((section, index) => ({
    id: section.id,
    label: index === 0 ? 'Screening' : section.title,
    count: section.items.length,
    to: index === 0 ? `/s/${token}` : `#${section.id}`,
    active: index === 0,
  }))

  return (
    <Page
      appBar={
        <AppBar
          name={content.candidate.name}
          headline={content.candidate.headline}
          links={content.candidate.links}
          statusChip={statusChip}
          sessionChip={sessionChip}
          tabs={tabs}
        />
      }
    >
      <Surface title="Logistics" icon={MapPin} count={pluralize(content.logistics.length, 'item')}>
        <LogisticsList logistics={content.logistics} />
      </Surface>

      {content.sections.map((section, index) => (
        <Surface
          key={section.id}
          id={section.id}
          title={section.title}
          icon={sectionIcon(index)}
          count={pluralize(section.items.length, 'answer')}
        >
          <SectionItems section={section} />
        </Surface>
      ))}

      {state.status === 'live' && (
        <Surface title="Questions for you" count={statusChip} dark>
          <CompanyQuestionsForm
            token={token}
            questions={content.company_questions}
            onProgress={setAnsweredRequired}
            onSubmitted={(submittedAt) =>
              setState({
                status: 'submitted',
                session: { ...session, answers_submitted: true, submitted_at: submittedAt },
                content,
              })
            }
            onAlreadySubmitted={() => setState({ status: 'already_submitted', session, content })}
          />
        </Surface>
      )}

      {state.status === 'submitted' && (
        <Alert>
          <AlertTitle>Thanks, your answers are in</AlertTitle>
          <AlertDescription>The candidate will follow up from here.</AlertDescription>
        </Alert>
      )}

      {state.status === 'already_submitted' && (
        <Alert>
          <AlertTitle>Answers already submitted</AlertTitle>
          <AlertDescription>
            This session already has answers on file for these questions.
          </AlertDescription>
        </Alert>
      )}
    </Page>
  )
}
