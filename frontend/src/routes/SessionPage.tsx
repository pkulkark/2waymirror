import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  CheckCircle2,
  Code,
  FileText,
  LoaderCircle,
  MapPin,
  MessagesSquare,
  User,
  type LucideIcon,
} from 'lucide-react'

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
import {
  clearAnswerDraft,
  currentAnswers,
  readAnswerDraft,
  writeAnswerDraft,
} from '@/lib/answerDrafts'
import { cn } from '@/lib/utils'

type PageState =
  | { status: 'loading' }
  | { status: 'not_found' }
  | { status: 'expired' }
  | { status: 'error'; detail: string }
  | { status: 'live'; session: Session; content: Content }

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
   * state, and a second submit cannot start while the first is in flight. The page also
   * persists edits per session token so the draft survives reloads.
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
  const reducedMotion = useReducedMotion()

  return (
    <form
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        submit()
      }}
      className="text-on-dark flex flex-col gap-5"
      noValidate
      aria-busy={submitting}
    >
      <p className="text-on-dark-muted text-[15px]">
        Answers stay editable until the link expires.
      </p>
      {formError && (
        <p role="alert" className="text-danger-on-dark text-[15px]">
          {formError}
        </p>
      )}
      {questions.map((q) => (
        <div key={q.id} className="flex flex-col gap-1.5">
          <label
            htmlFor={`question-${q.id}`}
            className="flex items-center gap-2.5 text-[15px] font-semibold"
          >
            {q.question}
            {q.required && (
              <span className="border-dark-border text-on-dark-muted rounded-full border px-2 py-0.5 text-xs font-normal">
                Required
              </span>
            )}
          </label>
          <Textarea
            id={`question-${q.id}`}
            aria-invalid={Boolean(fieldErrors[q.id])}
            aria-describedby={fieldErrors[q.id] ? `error-${q.id}` : undefined}
            required={q.required}
            disabled={submitting}
            className="bg-dark-input border-dark-border text-on-dark h-24 min-h-24 field-sizing-fixed rounded-lg px-3.5 py-3 text-[15px] shadow-none focus-visible:border-moss focus-visible:ring-moss focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-dark aria-invalid:border-danger-on-dark aria-invalid:ring-danger-on-dark motion-reduce:transition-none md:text-[15px]"
            value={values[q.id] ?? ''}
            onChange={(e) => onChange(q.id, e.target.value)}
          />
          {fieldErrors[q.id] && (
            <p id={`error-${q.id}`} role="alert" className="text-danger-on-dark text-sm">
              {fieldErrors[q.id]}
            </p>
          )}
        </div>
      ))}
      <Button
        type="submit"
        disabled={submitting}
        className="bg-on-dark text-dark hover:bg-on-dark/90 focus-visible:ring-moss focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-dark h-11 w-fit rounded-lg px-5 text-[15px] font-semibold motion-reduce:transition-none"
      >
        {submitting && (
          <LoaderCircle
            aria-hidden="true"
            className={cn('size-4', !reducedMotion && 'animate-spin')}
          />
        )}
        {submitting ? 'Sending' : 'Send answers'}
      </Button>
    </form>
  )
}

interface AnswerSubmission {
  submitting: boolean
  formError: string | null
  fieldErrors: Record<string, string>
  submit: () => void
  clearErrors: () => void
}

interface UseAnswerSubmissionArgs {
  token: string | undefined
  questions: CompanyQuestion[]
  values: Record<string, string>
  onSubmitted: (
    submittedAt: string,
    answers: Record<string, string>,
    questions: CompanyQuestion[],
  ) => void
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
}: UseAnswerSubmissionArgs): AnswerSubmission {
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const inFlight = useRef(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

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
      Object.entries(currentAnswers(values, questions)).filter(
        ([, value]) => value.trim().length > 0,
      ),
    )

    inFlight.current = true
    setSubmitting(true)
    const result = await submitAnswers(token, answers)
    if (!mounted.current) return
    inFlight.current = false
    setSubmitting(false)

    if (result.kind === 'ok') {
      onSubmitted(result.data.submitted_at, answers, questions)
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

  return {
    submitting,
    formError,
    fieldErrors,
    submit: () => void submit(),
    clearErrors: () => {
      setFormError(null)
      setFieldErrors({})
    },
  }
}

export default function SessionPage() {
  const { token } = useParams<{ token: string }>()
  // Changing companies starts a new state owner; tab changes keep it mounted.
  return <SessionPageForToken key={token} token={token} />
}

function SessionPageForToken({ token }: { token: string | undefined }) {
  const { section: sectionParam } = useParams<{ section?: string }>()
  const { hash } = useLocation()
  const navigate = useNavigate()
  const reducedMotion = useReducedMotion()
  const [state, setState] = useState<PageState>({ status: 'loading' })
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [editing, setEditing] = useState(false)
  const submission = useAnswerSubmission({
    token,
    questions: state.status === 'live' ? state.content.company_questions : [],
    values: answers,
    onSubmitted: (submittedAt, sentAnswers, questions) => {
      if (token) clearAnswerDraft(token)
      setEditing(false)
      setState((previous) =>
        previous.status === 'live'
          ? {
              ...previous,
              session: {
                ...previous.session,
                answers_submitted: true,
                submitted_at: submittedAt,
                answers: sentAnswers,
                questions,
              },
            }
          : previous,
      )
    },
  })

  useEffect(() => {
    if (!token) return
    let cancelled = false
    setState({ status: 'loading' })

    fetchSession(token).then((result) => {
      if (cancelled) return
      if (result.kind === 'ok') {
        const { session, content } = result.data
        const draft = readAnswerDraft(token, session.submitted_at ?? null)
        setAnswers(
          currentAnswers(draft?.answers ?? session.answers ?? {}, content.company_questions),
        )
        setEditing(!session.answers_submitted || draft !== null)
        setState({ status: 'live', session, content })
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

  const sent = session.answers_submitted
  const requiredCount = content.company_questions.filter((q) => q.required).length
  const answeredRequired = content.company_questions.filter(
    (q) => q.required && answers[q.id]?.trim(),
  ).length
  const statusChip = sent
    ? session.submitted_at
      ? `Sent ${formatDate(session.submitted_at, LONG_MONTHS)}`
      : 'Sent'
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

        {screening && (
          <Surface title="Questions for you" count={statusChip} dark>
            {editing ? (
              <CompanyQuestionsForm
                questions={content.company_questions}
                values={answers}
                onChange={(id, value) => {
                  if (submission.submitting) return
                  const next = { ...answers, [id]: value }
                  setAnswers(next)
                  submission.clearErrors()
                  writeAnswerDraft(token, {
                    submittedAt: session.submitted_at ?? null,
                    answers: next,
                  })
                }}
                submission={submission}
              />
            ) : (
              <div
                className={cn(
                  'text-on-dark flex flex-col gap-7',
                  !reducedMotion && 'animate-sent-in',
                )}
              >
                <div className="flex items-center justify-between gap-6">
                  <p role="status" className="flex items-center gap-2.5 text-[15px]">
                    <CheckCircle2 aria-hidden="true" className="size-5 shrink-0" />
                    <span>
                      Answers sent
                      {session.submitted_at
                        ? ` on ${formatDate(session.submitted_at, LONG_MONTHS)}`
                        : ''}
                      . I will reply by email within two working days.
                    </span>
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-dark-border text-on-dark hover:bg-dark-input hover:text-on-dark focus-visible:ring-moss focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-dark h-11 shrink-0 rounded-lg bg-transparent text-[15px] motion-reduce:transition-none"
                    onClick={() => {
                      submission.clearErrors()
                      setAnswers(currentAnswers(session.answers ?? {}, content.company_questions))
                      setEditing(true)
                    }}
                  >
                    Edit answers
                  </Button>
                </div>
                <dl className="flex flex-col gap-5">
                  {(session.questions ?? []).map((question) => (
                    <div key={question.id} className="flex flex-col gap-2">
                      <dt className="text-[15px] font-semibold">{question.question}</dt>
                      <dd
                        className={cn(
                          'whitespace-pre-wrap break-words',
                          session.answers?.[question.id]?.trim()
                            ? 'font-serif text-[17px] leading-[1.5]'
                            : 'text-on-dark-muted text-[15px] italic',
                        )}
                      >
                        {session.answers?.[question.id]?.trim()
                          ? session.answers[question.id]
                          : 'Not answered yet'}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </Surface>
        )}
      </div>
    </Page>
  )
}
