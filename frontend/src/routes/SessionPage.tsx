import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Code, FileText, MapPin, MessagesSquare, User, type LucideIcon } from 'lucide-react'

import {
  fetchSession,
  submitAnswers,
  type CompanyQuestion,
  type Content,
  type Logistics,
  type Session,
} from '@/api'
import Answer from '@/components/Answer'
import AppBar, { type AppBarTab } from '@/components/AppBar'
import Page from '@/components/Page'
import Surface from '@/components/Surface'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useReducedMotion } from '@/lib/motion'
import { cn } from '@/lib/utils'

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

function SectionItems({ section }: { section: Content['sections'][number] }) {
  return (
    <div className="flex flex-col">
      {section.items.map((item) => (
        <div
          key={item.id}
          className="border-hairline border-t py-7 first:border-t-0 first:pt-0 last:pb-0"
        >
          <Answer item={item} />
        </div>
      ))}
    </div>
  )
}

interface CompanyQuestionsFormProps {
  questions: CompanyQuestion[]
  /**
   * The typed answers and the submission state are held by the page, not the form, so that
   * leaving the screening tab mid-request and coming back shows the same pending or failed
   * state, and a second submit cannot start while the first is in flight. Browser
   * persistence across a closed tab is #109.
   */
  values: Record<string, string>
  onChange: (id: string, value: string) => void
  submission: AnswerSubmission
}

function CompanyQuestionsForm({
  questions,
  values,
  onChange,
  submission,
}: CompanyQuestionsFormProps) {
  const { submitting, formError, fieldErrors, submit } = submission

  return (
    <form
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        submit()
      }}
      className="text-on-dark flex flex-col gap-5"
      noValidate
    >
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
            onChange={(e) => onChange(q.id, e.target.value)}
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

interface AnswerSubmission {
  submitting: boolean
  formError: string | null
  fieldErrors: Record<string, string>
  submit: () => void
}

interface UseAnswerSubmissionArgs {
  token: string | undefined
  questions: CompanyQuestion[]
  values: Record<string, string>
  onSubmitted: (submittedAt: string) => void
  onAlreadySubmitted: () => void
}

/**
 * The submit request and its outcome, owned by the page. The in-flight flag lives in a ref as
 * well as in state so that a click racing a pending request is ignored even before React
 * re-renders, and a request that finishes after the form unmounted still lands its result.
 */
function useAnswerSubmission({
  token,
  questions,
  values,
  onSubmitted,
  onAlreadySubmitted,
}: UseAnswerSubmissionArgs): AnswerSubmission {
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const inFlight = useRef(false)

  const submit = async () => {
    if (!token || inFlight.current) return
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

    inFlight.current = true
    setSubmitting(true)
    const result = await submitAnswers(token, answers)
    inFlight.current = false
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

  return { submitting, formError, fieldErrors, submit: () => void submit() }
}

export default function SessionPage() {
  const { token, section: sectionParam } = useParams<{ token: string; section?: string }>()
  const { hash } = useLocation()
  const navigate = useNavigate()
  const reducedMotion = useReducedMotion()
  const [state, setState] = useState<PageState>({ status: 'loading' })
  // Held here, not in the form, so that leaving the screening tab and coming back keeps
  // whatever was typed. Persisting it in the browser is #109.
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const submission = useAnswerSubmission({
    token,
    questions: state.status === 'live' ? state.content.company_questions : [],
    values: answers,
    onSubmitted: (submittedAt) =>
      setState((previous) =>
        previous.status === 'live'
          ? {
              status: 'submitted',
              session: { ...previous.session, answers_submitted: true, submitted_at: submittedAt },
              content: previous.content,
            }
          : previous,
      ),
    onAlreadySubmitted: () =>
      setState((previous) =>
        previous.status === 'live' ? { ...previous, status: 'already_submitted' } : previous,
      ),
  })

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

  // Tab routing. `/s/:token` is the screening tab, which carries the first section; every other
  // section is `/s/:token/:section`. Sections are only known once the content is in, so the
  // routing is worked out here rather than in the router.
  const sections = 'content' in state ? state.content.sections : []
  const sectionIndex = sectionParam ? sections.findIndex((s) => s.id === sectionParam) : 0
  // Index 0 has no route of its own, so its id in the URL is as unknown as a made-up one.
  const unknownSection = Boolean(sectionParam) && sections.length > 0 && sectionIndex < 1
  const activeIndex = sectionIndex < 1 ? 0 : sectionIndex
  const activeSectionId = sections[activeIndex]?.id
  const previousSectionId = useRef<string | null>(null)

  useEffect(() => {
    if (unknownSection) navigate(`/s/${token}`, { replace: true })
  }, [navigate, token, unknownSection])

  useEffect(() => {
    if (!activeSectionId) return
    // Only on a change: the first render of a tab route is already at the top.
    if (previousSectionId.current !== null && previousSectionId.current !== activeSectionId) {
      window.scrollTo({ top: 0 })
    }
    previousSectionId.current = activeSectionId
  }, [activeSectionId])

  // A shared link to an evidence row lands on a page that is still loading, so the browser has
  // nothing to scroll to and gives up. Jump once the content is in. `loaded` only ever flips
  // false to true, so submitting the form later does not send the reader back up the page.
  const loaded = state.status !== 'loading'

  useEffect(() => {
    if (!loaded || !hash) return
    document.getElementById(hash.slice(1))?.scrollIntoView()
  }, [hash, loaded])

  if (!token) return <NotFoundState />
  if (state.status === 'loading') return <LoadingSkeleton />
  if (state.status === 'not_found') return <NotFoundState />
  if (state.status === 'expired') return <ExpiredState />
  if (state.status === 'error') return <ErrorState detail={state.detail} />

  const { session, content } = state

  const sent = state.status !== 'live'
  const requiredCount = content.company_questions.filter((q) => q.required).length
  const answeredRequired = content.company_questions.filter(
    (q) => q.required && answers[q.id]?.trim(),
  ).length
  const statusChip = sent
    ? `Sent ${formatDate(session.submitted_at ?? new Date().toISOString(), LONG_MONTHS)}`
    : `${answeredRequired} of ${requiredCount} required answered`
  const sessionChip = `${session.company}, until ${formatDate(session.expires_at, SHORT_MONTHS)}`

  const tabs: AppBarTab[] = content.sections.map((section, index) => ({
    id: section.id,
    label: index === 0 ? 'Screening' : section.title,
    count: section.items.length,
    to: index === 0 ? `/s/${token}` : `/s/${token}/${section.id}`,
    active: index === activeIndex,
  }))

  const activeSection = content.sections[activeIndex]
  const screening = activeIndex === 0

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
      {/* Keyed on the section so a tab change replays the fade. */}
      <div
        key={activeSectionId ?? 'screening'}
        className={cn('flex flex-col gap-6', !reducedMotion && 'animate-tab-in')}
      >
        {screening && (
          <Surface
            title="Logistics"
            icon={MapPin}
            count={pluralize(content.logistics.length, 'item')}
          >
            <LogisticsList logistics={content.logistics} />
          </Surface>
        )}

        {activeSection && (
          <Surface
            id={activeSection.id}
            title={activeSection.title}
            icon={sectionIcon(activeIndex)}
            count={pluralize(activeSection.items.length, 'answer')}
          >
            <SectionItems section={activeSection} />
          </Surface>
        )}

        {screening && state.status === 'live' && (
          <Surface title="Questions for you" count={statusChip} dark>
            <CompanyQuestionsForm
              questions={content.company_questions}
              values={answers}
              onChange={(id, value) => setAnswers((previous) => ({ ...previous, [id]: value }))}
              submission={submission}
            />
          </Surface>
        )}

        {screening && state.status === 'submitted' && (
          <Alert>
            <AlertTitle>Thanks, your answers are in</AlertTitle>
            <AlertDescription>The candidate will follow up from here.</AlertDescription>
          </Alert>
        )}

        {screening && state.status === 'already_submitted' && (
          <Alert>
            <AlertTitle>Answers already submitted</AlertTitle>
            <AlertDescription>
              This session already has answers on file for these questions.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </Page>
  )
}
