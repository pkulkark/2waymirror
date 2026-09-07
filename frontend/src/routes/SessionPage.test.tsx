import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, test, vi } from 'vitest'

import SessionPage from '@/routes/SessionPage'
import type { SessionContentResponse } from '@/api'

const sample: SessionContentResponse = {
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
    logistics: [
      { label: 'Availability', value: 'Two weeks notice' },
      { label: 'Compensation', value: 'EUR 70k' },
    ],
    sections: [
      {
        id: 'intro',
        title: 'Initial conversation',
        items: [
          {
            id: 'why-leaving',
            question: 'Why are you leaving?',
            summary: 'Looking for more ownership.',
            answer_md: 'Looking for **new** challenges.',
            evidence: [{ label: 'Conference talk', url: 'https://example.com/talk', type: 'talk' }],
          },
          {
            id: 'team-fit',
            question: 'What kind of team do you work best with?',
            answer_md: 'Small and async-first.',
            evidence: [{ label: 'Untyped link', url: 'https://example.com/untyped' }],
          },
        ],
      },
    ],
    company_questions: [
      { id: 'team-structure', question: 'How is the team structured?', required: true },
      { id: 'growth-path', question: 'What is the growth path?', required: false },
    ],
  },
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response
}

function renderAt(token: string) {
  return render(
    <MemoryRouter initialEntries={[`/s/${token}`]}>
      <Routes>
        <Route path="/s/:token" element={<SessionPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('SessionPage', () => {
  test('shows a loading skeleton immediately, then the live view', async () => {
    let resolveFetch: (value: Response) => void = () => {}
    const pending = new Promise<Response>((resolve) => {
      resolveFetch = resolve
    })
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(pending))

    const { container } = renderAt('tok123')
    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull()

    resolveFetch(jsonResponse(200, sample))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Jordan Sample' })).toBeInTheDocument()
    })
    expect(screen.getByText('Senior Backend Engineer')).toBeInTheDocument()
    expect(screen.getByText('Why are you leaving?')).toBeInTheDocument()
    expect(screen.getByText('Looking for more ownership.')).toBeInTheDocument()
    expect(screen.getByText('Availability')).toBeInTheDocument()
    expect(screen.getByText('Two weeks notice')).toBeInTheDocument()
    const typedLink = screen.getByRole('link', { name: /Conference talk/ })
    expect(typedLink).toHaveAttribute('href', 'https://example.com/talk')
    expect(typedLink).toHaveTextContent('Talk: Conference talk')
    const untypedLink = screen.getByRole('link', { name: 'Untyped link' })
    expect(untypedLink).toHaveAttribute('href', 'https://example.com/untyped')
    expect(untypedLink).toHaveTextContent('Untyped link')
    expect(untypedLink.textContent).not.toContain(':')
  })

  test('shows a not-found state on 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(404, { detail: 'nope' })))
    renderAt('missing')
    await waitFor(() => {
      expect(screen.getByText('Session not found')).toBeInTheDocument()
    })
  })

  test('shows an expired state on 410', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(410, { detail: 'gone' })))
    renderAt('expiredtok')
    await waitFor(() => {
      expect(screen.getByText('Session expired')).toBeInTheDocument()
    })
  })

  test('shows an already-submitted state when the session says so', async () => {
    const submittedSample: SessionContentResponse = {
      ...sample,
      session: { ...sample.session, answers_submitted: true },
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, submittedSample)))
    renderAt('tok123')
    await waitFor(() => {
      expect(screen.getByText('Answers already submitted')).toBeInTheDocument()
    })
  })

  test('submits answers and shows a submitted state on 201', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      if (!init) return Promise.resolve(jsonResponse(200, sample))
      return Promise.resolve(jsonResponse(201, { submitted_at: '2026-09-02T00:00:00Z' }))
    })
    vi.stubGlobal('fetch', fetchMock)

    renderAt('tok123')
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Jordan Sample' })).toBeInTheDocument()
    })

    await user.type(screen.getByLabelText(/How is the team structured/), 'A small platform team.')
    await user.click(screen.getByRole('button', { name: 'Submit answers' }))

    await waitFor(() => {
      expect(screen.getByText('Thanks, your answers are in')).toBeInTheDocument()
    })

    const submitCall = fetchMock.mock.calls.find(([, init]) => init)
    if (!submitCall) throw new Error('expected a submit call')
    const body = JSON.parse((submitCall[1] as RequestInit).body as string)
    expect(body.answers['team-structure']).toBe('A small platform team.')
    expect(body.answers['growth-path']).toBeUndefined()
  })

  test('blocks submission client-side when a required question is empty', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, sample)))
    renderAt('tok123')
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Jordan Sample' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Submit answers' }))
    expect(screen.getByText('This question requires an answer.')).toBeInTheDocument()
  })

  test('shows an already-submitted state on 409 from the submit call', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      if (!init) return Promise.resolve(jsonResponse(200, sample))
      return Promise.resolve(jsonResponse(409, { detail: 'Answers already submitted.' }))
    })
    vi.stubGlobal('fetch', fetchMock)

    renderAt('tok123')
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Jordan Sample' })).toBeInTheDocument()
    })

    await user.type(screen.getByLabelText(/How is the team structured/), 'A small platform team.')
    await user.click(screen.getByRole('button', { name: 'Submit answers' }))

    await waitFor(() => {
      expect(screen.getByText('Answers already submitted')).toBeInTheDocument()
    })
  })

  test('shows field errors on 422', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      if (!init) return Promise.resolve(jsonResponse(200, sample))
      return Promise.resolve(jsonResponse(422, { detail: 'Answer for team-structure is empty.' }))
    })
    vi.stubGlobal('fetch', fetchMock)

    renderAt('tok123')
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Jordan Sample' })).toBeInTheDocument()
    })

    await user.type(screen.getByLabelText(/How is the team structured/), 'x')
    await user.click(screen.getByRole('button', { name: 'Submit answers' }))

    await waitFor(() => {
      expect(screen.getByText('Answer for team-structure is empty.')).toBeInTheDocument()
    })
  })

  test('shows a form error when the session became unavailable mid-submit', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      if (!init) return Promise.resolve(jsonResponse(200, sample))
      return Promise.resolve(jsonResponse(410, { detail: 'gone' }))
    })
    vi.stubGlobal('fetch', fetchMock)

    renderAt('tok123')
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Jordan Sample' })).toBeInTheDocument()
    })

    await user.type(screen.getByLabelText(/How is the team structured/), 'x')
    await user.click(screen.getByRole('button', { name: 'Submit answers' }))

    await waitFor(() => {
      expect(
        screen.getByText(
          'This session is no longer available. Refresh the page for the latest state.',
        ),
      ).toBeInTheDocument()
    })
  })

  test('shows a generic form error on an unexpected submit failure', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      if (!init) return Promise.resolve(jsonResponse(200, sample))
      return Promise.resolve(jsonResponse(500, { detail: 'server exploded' }))
    })
    vi.stubGlobal('fetch', fetchMock)

    renderAt('tok123')
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Jordan Sample' })).toBeInTheDocument()
    })

    await user.type(screen.getByLabelText(/How is the team structured/), 'x')
    await user.click(screen.getByRole('button', { name: 'Submit answers' }))

    await waitFor(() => {
      expect(screen.getByText('server exploded')).toBeInTheDocument()
    })
  })

  test('shows a generic error state when the fetch fails outright', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    renderAt('tok123')
    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    })
  })
})
