/**
 * Typed API client for the 2WayMirror backend.
 *
 * Types mirror docs/architecture.md ("API", "Content") exactly: `Session` is the shape
 * `GET /api/sessions/{token}` returns under `session`, `Content` is the shape it returns
 * under `content`, and the errors are the status codes the contract lists for each route.
 */

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

export type SessionFetchResult =
  | { kind: 'ok'; data: SessionContentResponse }
  | { kind: 'not_found' }
  | { kind: 'expired' }
  | { kind: 'error'; detail: string }

export type SubmitAnswersResult =
  | { kind: 'ok'; data: SubmitAnswersResponse }
  | { kind: 'not_found' }
  | { kind: 'expired' }
  | { kind: 'invalid'; detail: string }
  | { kind: 'error'; detail: string }

async function readDetail(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json()
    if (
      body &&
      typeof body === 'object' &&
      'detail' in body &&
      typeof (body as { detail: unknown }).detail === 'string'
    ) {
      return (body as { detail: string }).detail
    }
  } catch {
    // Fall through to the generic message below.
  }
  return `Request failed with status ${response.status}.`
}

export async function fetchSession(token: string): Promise<SessionFetchResult> {
  let response: Response
  try {
    response = await fetch(`/api/sessions/${encodeURIComponent(token)}`)
  } catch {
    return { kind: 'error', detail: 'Could not reach the server. Check your connection.' }
  }

  if (response.status === 404) return { kind: 'not_found' }
  if (response.status === 410) return { kind: 'expired' }
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
      if (
        typeof data.submitted_at !== 'string' ||
        !Number.isFinite(Date.parse(data.submitted_at))
      ) {
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
  if (response.status === 410) return { kind: 'expired' }
  if (response.status === 422) return { kind: 'invalid', detail: await readDetail(response) }
  return { kind: 'error', detail: await readDetail(response) }
}
