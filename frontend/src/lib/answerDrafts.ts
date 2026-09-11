import type { CompanyQuestion } from '@/api'

interface AnswerDraft {
  submittedAt: string | null
  answers: Record<string, string>
}

function draftKey(token: string): string {
  return `2waymirror:answers:${token}`
}

/** Only current questions may be sent; removed questions must not leak out of an old draft. */
export function currentAnswers(
  answers: Record<string, string>,
  questions: CompanyQuestion[],
): Record<string, string> {
  return Object.fromEntries(
    questions.map(({ id }) => [id, typeof answers[id] === 'string' ? answers[id] : '']),
  )
}

export function readAnswerDraft(token: string, submittedAt: string | null): AnswerDraft | null {
  try {
    const stored = localStorage.getItem(draftKey(token))
    if (!stored) return null
    const draft: unknown = JSON.parse(stored)
    if (
      !draft ||
      typeof draft !== 'object' ||
      !('submittedAt' in draft) ||
      draft.submittedAt !== submittedAt ||
      !('answers' in draft) ||
      !draft.answers ||
      typeof draft.answers !== 'object' ||
      Array.isArray(draft.answers) ||
      !Object.values(draft.answers).every((value) => typeof value === 'string')
    )
      return null
    return draft as AnswerDraft
  } catch {
    // Storage may be unavailable or contain a damaged draft. The form still works in memory.
    return null
  }
}

export function writeAnswerDraft(token: string, draft: AnswerDraft): void {
  try {
    localStorage.setItem(draftKey(token), JSON.stringify(draft))
  } catch {
    // A blocked or full store must not prevent typing or sending.
  }
}

export function clearAnswerDraft(token: string): void {
  try {
    localStorage.removeItem(draftKey(token))
  } catch {
    // A stale draft is also ignored when its submission timestamp no longer matches.
  }
}
