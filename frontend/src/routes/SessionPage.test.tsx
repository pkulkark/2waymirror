import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
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
    candidate: {
      name: 'Jordan Sample',
      headline: 'Senior Backend Engineer',
      links: [
        { label: 'Email', url: 'mailto:jordan@example.com' },
        { label: 'GitHub', url: 'https://github.com/jordan' },
      ],
    },
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
      {
        id: 'behavioral',
        title: 'Behavioral',
        items: [
          {
            id: 'conflict',
            question: 'Tell me about a disagreement you handled well.',
            answer_md: 'We wrote the tradeoffs down and picked one.',
            evidence: [],
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

/** Reports the current URL so a test can assert a redirect. */
function LocationProbe() {
  const { pathname } = useLocation()
  return <span data-testid="pathname">{pathname}</span>
}

function renderAt(token: string, section?: string) {
  return render(
    <MemoryRouter initialEntries={[section ? `/s/${token}/${section}` : `/s/${token}`]}>
      <Routes>
        <Route path="/s/:token/:section?" element={<SessionPage />} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  )
}

/** The typed answers live on the page, so the app bar chip and the form share this label. */
function questionField() {
  return screen.getByLabelText(/How is the team structured/)
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
    const skeleton = container.querySelector('[data-slot="skeleton"]')
    expect(skeleton).not.toBeNull()
    // Neutral placeholder colour, not the accent green.
    expect(skeleton).toHaveClass('bg-skeleton')

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
  test('shows the session and status chips in the app bar', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, sample)))
    renderAt('tok123')
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Jordan Sample' })).toBeInTheDocument()
    })

    expect(screen.getByText('Acme, until 8 Sep')).toBeInTheDocument()
    // Once as the app bar chip, once as the questions surface count.
    expect(screen.getAllByText('0 of 1 required answered')).toHaveLength(2)
    expect(screen.getByRole('link', { name: 'Email' })).toHaveAttribute(
      'href',
      'mailto:jordan@example.com',
    )
  })

  test('gives every section a tab route, the screening one active by default', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, sample)))
    renderAt('tok123')
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Jordan Sample' })).toBeInTheDocument()
    })

    const screening = screen.getByRole('link', { name: /Screening/ })
    expect(screening).toHaveAttribute('href', '/s/tok123')
    expect(screening).toHaveAttribute('aria-current', 'page')
    expect(screening).toHaveTextContent('2')

    const behavioral = screen.getByRole('link', { name: /Behavioral/ })
    expect(behavioral).toHaveAttribute('href', '/s/tok123/behavioral')
    expect(behavioral).not.toHaveAttribute('aria-current')
    expect(behavioral).toHaveTextContent('1')
  })

  test('shows logistics, the first section, and the form on the screening tab only', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, sample)))
    renderAt('tok123')
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Jordan Sample' })).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: /Logistics/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Initial conversation/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Questions for you/ })).toBeInTheDocument()
    // The second section has a tab of its own, so it is not on this one.
    expect(screen.queryByRole('button', { name: /^Behavioral/ })).not.toBeInTheDocument()
    expect(
      screen.queryByText('Tell me about a disagreement you handled well.'),
    ).not.toBeInTheDocument()
  })

  test('shows only its own section on a section route, with that tab active', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, sample)))
    renderAt('tok123', 'behavioral')
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Jordan Sample' })).toBeInTheDocument()
    })

    expect(screen.getByText('Tell me about a disagreement you handled well.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Logistics/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Initial conversation/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Questions for you/ })).not.toBeInTheDocument()
    // The app bar and the footer stay on every tab.
    expect(screen.getByText('Acme, until 8 Sep')).toBeInTheDocument()
    expect(screen.getByText('Built by the candidate.')).toBeInTheDocument()

    expect(screen.getByRole('link', { name: /Behavioral/ })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: /Screening/ })).not.toHaveAttribute('aria-current')
  })

  test.each([
    ['a section that is not in the content', 'made-up'],
    ['the first section, which the screening tab already carries', 'intro'],
  ])('falls back to the screening tab for %s', async (_label, section) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, sample)))
    renderAt('tok123', section)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Logistics/ })).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: /Initial conversation/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Screening/ })).toHaveAttribute('aria-current', 'page')
    await waitFor(() => {
      expect(screen.getByTestId('pathname')).toHaveTextContent('/s/tok123')
    })
    expect(screen.getByTestId('pathname').textContent).toBe('/s/tok123')
  })

  test('fetches the session once across tab changes, and scrolls back to the top', async () => {
    const user = userEvent.setup()
    const scrollTo = vi.fn()
    vi.stubGlobal('scrollTo', scrollTo)
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, sample))
    vi.stubGlobal('fetch', fetchMock)

    renderAt('tok123')
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Jordan Sample' })).toBeInTheDocument()
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(scrollTo).not.toHaveBeenCalled()

    await user.click(screen.getByRole('link', { name: /Behavioral/ }))
    await waitFor(() => {
      expect(screen.getByText('Tell me about a disagreement you handled well.')).toBeInTheDocument()
    })
    expect(scrollTo).toHaveBeenCalledWith({ top: 0 })

    await user.click(screen.getByRole('link', { name: /Screening/ }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Logistics/ })).toBeInTheDocument()
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test('keeps unsent answer text when the visitor leaves and returns to the tab', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('scrollTo', vi.fn())
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, sample)))

    renderAt('tok123')
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Jordan Sample' })).toBeInTheDocument()
    })

    await user.type(questionField(), 'Four squads.')
    expect(screen.getAllByText('1 of 1 required answered').length).toBeGreaterThan(0)

    await user.click(screen.getByRole('link', { name: /Behavioral/ }))
    await waitFor(() => {
      expect(screen.getByText('Tell me about a disagreement you handled well.')).toBeInTheDocument()
    })
    // The chip counts the same answers from the page, with the form unmounted.
    expect(screen.getByText('1 of 1 required answered')).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: /Screening/ }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Questions for you/ })).toBeInTheDocument()
    })
    expect(questionField()).toHaveValue('Four squads.')
  })

  test('fades the tab content in, and not under reduced motion', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, sample)))
    const { container, unmount } = renderAt('tok123')
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Jordan Sample' })).toBeInTheDocument()
    })
    expect(container.querySelector('main > div')).toHaveClass('animate-tab-in')
    unmount()

    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    )
    const reduced = renderAt('tok123')
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Jordan Sample' })).toBeInTheDocument()
    })
    expect(reduced.container.querySelector('main > div')).not.toHaveClass('animate-tab-in')
  })

  test('counts filled required answers in the status chip as the visitor types', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, sample)))
    renderAt('tok123')
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Jordan Sample' })).toBeInTheDocument()
    })
    expect(screen.getAllByText('0 of 1 required answered').length).toBeGreaterThan(0)

    await userEvent.type(screen.getByLabelText(/How is the team structured/), 'Four squads.')

    expect(screen.getAllByText('1 of 1 required answered').length).toBeGreaterThan(0)
    expect(screen.queryByText('0 of 1 required answered')).not.toBeInTheDocument()

    await userEvent.clear(screen.getByLabelText(/How is the team structured/))
    expect(screen.getAllByText('0 of 1 required answered').length).toBeGreaterThan(0)
  })

  test('wraps logistics, each section, and the questions form in surfaces', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, sample)))
    renderAt('tok123')
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Jordan Sample' })).toBeInTheDocument()
    })

    const logistics = screen.getByRole('button', { name: /Logistics/ })
    expect(logistics).toHaveTextContent('2 items')
    expect(logistics.closest('section')).toHaveTextContent('Two weeks notice')

    expect(screen.getByRole('button', { name: /Initial conversation/ })).toHaveTextContent(
      '2 answers',
    )

    const questions = screen.getByRole('button', { name: /Questions for you/ })
    expect(questions.closest('section')).toHaveClass('bg-dark')
    expect(questions.closest('section')).toContainElement(
      screen.getByRole('button', { name: 'Submit answers' }),
    )
  })

  test('collapsing a surface hides its body from assistive tech', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, sample)))
    renderAt('tok123')
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Jordan Sample' })).toBeInTheDocument()
    })

    const logistics = screen.getByRole('button', { name: /Logistics/ })
    await user.click(logistics)
    expect(logistics).toHaveAttribute('aria-expanded', 'false')
  })

  test('shows a sent chip and no questions surface once answers are on file', async () => {
    const submittedSample: SessionContentResponse = {
      ...sample,
      session: {
        ...sample.session,
        answers_submitted: true,
        submitted_at: '2026-09-10T00:00:00Z',
      },
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, submittedSample)))
    renderAt('tok123')
    await waitFor(() => {
      expect(screen.getByText('Sent 10 September')).toBeInTheDocument()
    })

    expect(screen.queryByRole('button', { name: /Questions for you/ })).not.toBeInTheDocument()
  })

  test('gives each section surface its own icon', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, sample)))
    const { unmount } = renderAt('tok123')
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Jordan Sample' })).toBeInTheDocument()
    })
    const intro = screen
      .getByRole('button', { name: /Initial conversation/ })
      .querySelector('svg')
      ?.getAttribute('class')
    unmount()

    renderAt('tok123', 'behavioral')
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Behavioral/ })).toBeInTheDocument()
    })
    const behavioral = screen
      .getByRole('button', { name: /Behavioral/ })
      .querySelector('svg')
      ?.getAttribute('class')

    expect(intro).toBeTruthy()
    expect(behavioral).toBeTruthy()
    expect(intro).not.toBe(behavioral)
  })

  test('dates the sent chip from the timestamp the submit call returned', async () => {
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
      expect(screen.getByText('Sent 2 September')).toBeInTheDocument()
    })
  })

  test('falls back to today when a submitted session carries no timestamp', async () => {
    const submittedSample: SessionContentResponse = {
      ...sample,
      session: { ...sample.session, answers_submitted: true, submitted_at: null },
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, submittedSample)))
    renderAt('tok123')

    const today = new Date()
    const month = today.toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' })
    const day = today.getUTCDate()
    await waitFor(() => {
      expect(screen.getByText(`Sent ${day} ${month}`)).toBeInTheDocument()
    })
  })

  test('renders the wordmark bar on a dead end', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(404, { detail: 'nope' })))
    renderAt('missing')
    await waitFor(() => {
      expect(screen.getByText('Session not found')).toBeInTheDocument()
    })

    expect(screen.getByRole('heading', { name: '2WayMirror' })).toBeInTheDocument()
    expect(screen.getByText('Built by the candidate.')).toBeInTheDocument()
  })
})
