/**
 * Typed API client for the 2WayMirror backend.
 *
 * Types mirror docs/architecture.md ("API", "Content") exactly: `Session` is the shape
 * `GET /api/sessions/{token}` returns under `session`, `Content` is the shape it returns
 * under `content`, and the errors are the status codes the contract lists for each route.
 */

import { isIsoDate } from '@/lib/dates'

// Variant ids are declared by the candidate's content, not by the frontend.
export type Variant = string

export interface Session {
  company: string
  contact: string
  variant: Variant
  created_at: string
  expires_at: string
  answers_submitted: boolean
  submitted_at?: string | null
  answers?: Record<string, string> | null
  questions?: CompanyQuestion[] | null
}

export type EvidenceType = 'repo' | 'pr' | 'talk' | 'writeup' | 'other'

export interface Evidence {
  label: string
  url: string
  type?: EvidenceType
}

export interface CandidateLink {
  label: string
  url: string
}

export interface Candidate {
  name: string
  email?: string
  headline: string
  location?: string
  links?: CandidateLink[]
  [key: string]: unknown
}

export interface LogisticsItem {
  label: string
  value: string
}

export type Logistics = LogisticsItem[]

export interface SectionItem {
  id: string
  question: string
  summary?: string
  answer_md: string
  evidence: Evidence[]
}

export interface Section {
  id: string
  title: string
  items: SectionItem[]
}

export interface CompanyQuestion {
  id: string
  question: string
  required: boolean
}

export interface Content {
  candidate: Candidate
  logistics: Logistics
  sections: Section[]
  company_questions: CompanyQuestion[]
}

export interface SessionContentResponse {
  session: Session
  content: Content
}

export interface SubmitAnswersResponse {
  submitted_at: string
}

/**
 * The candidate's contact as the 410 body carries it (docs/architecture.md, "API"). Either
 * field is null when the body omits it or holds something that is not a string, so the expired
 * page can fall back to copy that names nobody.
 */
export interface ExpiredCandidate {
  name: string | null
  email: string | null
}

/**
 * What a 410 carries, whichever route answered it: both the session fetch and the answer
 * submission can find the link gone, and both hand the page the same contact to show.
 */
export interface ExpiredResult {
  kind: 'expired'
  candidate: ExpiredCandidate
  expires_at: string | null
}

export type SessionFetchResult =
  | { kind: 'ok'; data: SessionContentResponse }
  | { kind: 'not_found' }
  | ExpiredResult
  | { kind: 'error'; detail: string }

export type SubmitAnswersResult =
  | { kind: 'ok'; data: SubmitAnswersResponse }
  | { kind: 'not_found' }
  | ExpiredResult
  | { kind: 'invalid'; detail: string }
  | { kind: 'error'; detail: string }

function readRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function readString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

/** The parsed body, or null when there is none to parse. Each caller falls back on its own. */
async function readBody(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

async function readDetail(response: Response): Promise<string> {
  const detail = readString(readRecord(await readBody(response)).detail)
  return detail ?? `Request failed with status ${response.status}.`
}

/** A bare address, the only form that is safe to drop into a `mailto:` href unescaped. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+$/

/**
 * The candidate's address, or null when the backend sent something that is not one. The page
 * turns this into a `mailto:` link, so a display form ("Jordan Sample <jordan@example.com>")
 * and anything carrying mailto headers ("jordan@example.com?subject=…") are dropped rather
 * than repaired: the page then points the reader back at the message instead.
 */
function readEmail(value: unknown): string | null {
  const email = readString(value)
  return email !== null && EMAIL_SHAPE.test(email) && !email.includes('?') ? email : null
}

/**
 * The 410 body: `{"detail", "candidate": {"name", "email"}, "expires_at"}`. Read field by
 * field rather than cast, because an expired link is exactly the case where the page has no
 * other copy of the session to fall back on: anything missing or of the wrong type becomes
 * null and the page drops that part of the message. `expires_at` also has to look like an ISO
 * timestamp, since the page prints it.
 */
async function readExpired(response: Response): Promise<ExpiredResult> {
  const record = readRecord(await readBody(response))
  const candidate = readRecord(record.candidate)

  return {
    kind: 'expired',
    candidate: { name: readString(candidate.name), email: readEmail(candidate.email) },
    expires_at: isIsoDate(record.expires_at) ? record.expires_at : null,
  }
}

export async function fetchSession(token: string): Promise<SessionFetchResult> {
  let response: Response
  try {
    response = await fetch(`/api/sessions/${encodeURIComponent(token)}`)
  } catch {
    return { kind: 'error', detail: 'Could not reach the server. Check your connection.' }
  }

  if (response.status === 404) return { kind: 'not_found' }
  if (response.status === 410) return await readExpired(response)
  if (!response.ok) return { kind: 'error', detail: await readDetail(response) }

  const data = (await response.json()) as SessionContentResponse
  return { kind: 'ok', data }
}

export async function submitAnswers(
  token: string,
  answers: Record<string, string>,
): Promise<SubmitAnswersResult> {
  let response: Response
  try {
    response = await fetch(`/api/sessions/${encodeURIComponent(token)}/answers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers }),
    })
  } catch {
    return { kind: 'error', detail: 'Could not reach the server. Check your connection.' }
  }

  if (response.status === 201) {
    try {
      const data = (await response.json()) as SubmitAnswersResponse
      // A null body throws on the property read, which the catch below turns into the same
      // "could not confirm" result as a timestamp of the wrong shape.
      if (!isIsoDate(data.submitted_at)) {
        throw new Error('Invalid submission timestamp')
      }
      return { kind: 'ok', data }
    } catch {
      return {
        kind: 'error',
        detail: 'Could not confirm your answers were saved. Please try again.',
      }
    }
  }
  if (response.status === 404) return { kind: 'not_found' }
  // The same 410 body as the session fetch, so a link that expires mid-form takes the reader
  // to the expired page with the candidate's contact rather than to a "refresh" message.
  if (response.status === 410) return await readExpired(response)
  if (response.status === 422) return { kind: 'invalid', detail: await readDetail(response) }
  return { kind: 'error', detail: await readDetail(response) }
}
