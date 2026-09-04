import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'

import {
  fetchSession,
  submitAnswers,
  type CompanyQuestion,
  type Content,
  type Session,
} from '@/api'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

function LoadingSkeleton() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="mt-3 h-4 w-1/2" />
      <Skeleton className="mt-8 h-32 w-full" />
      <Skeleton className="mt-4 h-32 w-full" />
    </div>
  )
}

function NotFoundState() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Alert variant="destructive">
        <AlertTitle>Session not found</AlertTitle>
        <AlertDescription>
          This link doesn&apos;t match any session. Double check the URL, or ask for a new link.
        </AlertDescription>
      </Alert>
    </div>
  )
}

function ExpiredState() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Alert variant="destructive">
        <AlertTitle>Session expired</AlertTitle>
        <AlertDescription>
          This link is no longer active. Ask for a new one if you still need access.
        </AlertDescription>
      </Alert>
    </div>
  )
}

function ErrorState({ detail }: { detail: string }) {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Alert variant="destructive">
        <AlertTitle>Something went wrong</AlertTitle>
        <AlertDescription>{detail}</AlertDescription>
      </Alert>
    </div>
  )
}

function Logistics({ logistics }: { logistics: Record<string, string> }) {
  const entries = Object.entries(logistics).filter(([key]) => key !== 'variants')
  if (entries.length === 0) return null

  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
      {entries.map(([key, value]) => (
        <div key={key} className="flex flex-col">
          <dt className="text-muted-foreground text-xs tracking-wide uppercase">
            {key.replace(/_/g, ' ')}
          </dt>
          <dd className="text-sm">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function CandidateHeader({ content }: { content: Content }) {
  return (
    <header>
      <h1 className="text-2xl font-semibold tracking-tight">{content.candidate.name}</h1>
      <p className="text-muted-foreground mt-1">{content.candidate.headline}</p>
    </header>
  )
}

function AnswerSections({ sections }: { sections: Content['sections'] }) {
  return (
    <div className="mt-8 flex flex-col gap-6">
      {sections.map((section) => (
        <Card key={section.id}>
          <CardHeader>
            <CardTitle>{section.title}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {section.items.map((item) => (
              <div key={item.id}>
                <h3 className="font-medium">{item.question}</h3>
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
                          {ev.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

interface CompanyQuestionsFormProps {
  token: string
  questions: CompanyQuestion[]
  onSubmitted: () => void
  onAlreadySubmitted: () => void
}

function CompanyQuestionsForm({
  token,
  questions,
  onSubmitted,
  onAlreadySubmitted,
}: CompanyQuestionsFormProps) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const handleChange = (id: string, value: string) => {
    setValues((prev) => ({ ...prev, [id]: value }))
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
      onSubmitted()
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
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Questions for you</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
          {formError && (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}
          {questions.map((q) => (
            <div key={q.id} className="flex flex-col gap-1.5">
              <label htmlFor={`question-${q.id}`} className="text-sm font-medium">
                {q.question}
                {q.required && <span className="text-destructive ml-1">*</span>}
              </label>
              <Textarea
                id={`question-${q.id}`}
                aria-invalid={Boolean(fieldErrors[q.id])}
                value={values[q.id] ?? ''}
                onChange={(e) => handleChange(q.id, e.target.value)}
              />
              {fieldErrors[q.id] && <p className="text-destructive text-xs">{fieldErrors[q.id]}</p>}
            </div>
          ))}
          <Button type="submit" disabled={submitting} className="w-fit">
            {submitting ? 'Submitting...' : 'Submit answers'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

export default function SessionPage() {
  const { token } = useParams<{ token: string }>()
  const [state, setState] = useState<PageState>({ status: 'loading' })

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

  const badgeLabel = useMemo(() => {
    if (
      state.status !== 'live' &&
      state.status !== 'submitted' &&
      state.status !== 'already_submitted'
    )
      return null
    return state.session.variant
  }, [state])

  if (!token) return <NotFoundState />
  if (state.status === 'loading') return <LoadingSkeleton />
  if (state.status === 'not_found') return <NotFoundState />
  if (state.status === 'expired') return <ExpiredState />
  if (state.status === 'error') return <ErrorState detail={state.detail} />

  const { session, content } = state

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <CandidateHeader content={content} />
        {badgeLabel && <Badge variant="secondary">{badgeLabel}</Badge>}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Logistics</CardTitle>
        </CardHeader>
        <CardContent>
          <Logistics logistics={content.logistics} />
        </CardContent>
      </Card>

      <AnswerSections sections={content.sections} />

      {state.status === 'live' && (
        <CompanyQuestionsForm
          token={token}
          questions={content.company_questions}
          onSubmitted={() => setState({ status: 'submitted', session, content })}
          onAlreadySubmitted={() => setState({ status: 'already_submitted', session, content })}
        />
      )}

      {state.status === 'submitted' && (
        <Alert className="mt-6">
          <AlertTitle>Thanks, your answers are in</AlertTitle>
          <AlertDescription>The candidate will follow up from here.</AlertDescription>
        </Alert>
      )}

      {state.status === 'already_submitted' && (
        <Alert className="mt-6">
          <AlertTitle>Answers already submitted</AlertTitle>
          <AlertDescription>
            This session already has answers on file for these questions.
          </AlertDescription>
        </Alert>
      )}
    </main>
  )
}
