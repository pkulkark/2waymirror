import { afterEach, describe, expect, test, vi } from 'vitest'

import { fetchSession, submitAnswers, type SessionContentResponse } from '@/api'

const sampleResponse: SessionContentResponse = {
  session: {
    company: 'Acme',
    contact: 'Jamie',
    variant: 'senior',
    created_at: '2026-09-01T00:00:00Z',
    expires_at: '2026-09-08T00:00:00Z',
    answers_submitted: false,
  },
  content: {
    candidate: { name: 'Jordan Sample', headline: 'Senior Backend Engineer' },
    logistics: { availability: 'Two weeks notice' },
    sections: [],
    company_questions: [],
  },
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchSession', () => {
  test('returns ok on 200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, sampleResponse)))
    const result = await fetchSession('tok')
    expect(result).toEqual({ kind: 'ok', data: sampleResponse })
  })

  test('returns not_found on 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(404, { detail: 'nope' })))
    const result = await fetchSession('tok')
    expect(result).toEqual({ kind: 'not_found' })
  })

  test('returns expired on 410', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(410, { detail: 'gone' })))
    const result = await fetchSession('tok')
    expect(result).toEqual({ kind: 'expired' })
  })

  test('returns error on other non-ok status with detail', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(500, { detail: 'boom' })))
    const result = await fetchSession('tok')
    expect(result).toEqual({ kind: 'error', detail: 'boom' })
  })

  test('returns error with generic message when body has no detail', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 500,
        ok: false,
        json: async () => {
          throw new Error('not json')
        },
      } as unknown as Response),
    )
    const result = await fetchSession('tok')
    expect(result).toEqual({ kind: 'error', detail: 'Request failed with status 500.' })
  })

  test('returns error when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    const result = await fetchSession('tok')
    expect(result.kind).toBe('error')
  })
})

describe('submitAnswers', () => {
  test('returns ok on 201', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(201, { submitted_at: '2026-09-02T00:00:00Z' })),
    )
    const result = await submitAnswers('tok', { q1: 'answer' })
    expect(result).toEqual({ kind: 'ok', data: { submitted_at: '2026-09-02T00:00:00Z' } })
  })

  test('returns already_submitted on 409', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(409, { detail: 'Answers already submitted.' })),
    )
    const result = await submitAnswers('tok', { q1: 'answer' })
    expect(result).toEqual({ kind: 'already_submitted' })
  })

  test('returns invalid on 422 with detail', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(422, { detail: 'Unknown question id: q1' })),
    )
    const result = await submitAnswers('tok', { q1: 'answer' })
    expect(result).toEqual({ kind: 'invalid', detail: 'Unknown question id: q1' })
  })

  test('returns not_found on 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(404, { detail: 'nope' })))
    const result = await submitAnswers('tok', { q1: 'answer' })
    expect(result).toEqual({ kind: 'not_found' })
  })

  test('returns expired on 410', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(410, { detail: 'gone' })))
    const result = await submitAnswers('tok', { q1: 'answer' })
    expect(result).toEqual({ kind: 'expired' })
  })

  test('returns error on other status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(500, { detail: 'boom' })))
    const result = await submitAnswers('tok', { q1: 'answer' })
    expect(result).toEqual({ kind: 'error', detail: 'boom' })
  })

  test('returns error when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    const result = await submitAnswers('tok', { q1: 'answer' })
    expect(result.kind).toBe('error')
  })
})
