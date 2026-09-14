import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'

import HowIBuiltIt from './HowIBuiltIt'

function siteResponse(body: unknown, status = 200): Response {
  return { status, ok: status >= 200 && status < 300, json: async () => body } as Response
}

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderPage() {
  return render(
    <MemoryRouter>
      <HowIBuiltIt />
    </MemoryRouter>,
  )
}

test('provides runtime and deployment diagrams with text descriptions', () => {
  renderPage()
  const runtime = screen.getByRole('img', { name: 'Architecture diagram' })
  expect(runtime.querySelector('desc')).toHaveTextContent('CloudFront')
  expect(runtime).toHaveTextContent('S3 content bucket')
  const deploy = screen.getByRole('img', { name: 'Deploy pipeline' })
  const labels = Array.from(deploy.querySelectorAll('text')).map((node) => node.textContent)
  expect(labels.indexOf('Build Lambda package')).toBeLessThan(labels.indexOf('Terraform apply'))
  expect(deploy.querySelector('desc')).toHaveTextContent('short-lived AWS credentials')
})

test('each decision links to its own record and describes the rejected alternative', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(siteResponse({ feedback_email: 'jordan@example.com' })),
  )
  renderPage()
  const cards = screen.getAllByRole('article')
  expect(cards).toHaveLength(3)
  const records = [
    '0001-serverless-always-deployed-sessions-on-trigger.md',
    '0002-dynamodb-single-table.md',
    '0007-private-content-sample-candidate.md',
  ]
  cards.forEach((card, index) => {
    expect(within(card).getByText('Chosen')).toBeInTheDocument()
    expect(within(card).getByText('Instead of')).toBeInTheDocument()
    expect(within(card).getByRole('link')).toHaveAttribute(
      'href',
      `https://github.com/pkulkark/2waymirror/blob/main/docs/adr/${records[index]}`,
    )
  })
  const footer = screen.getByRole('navigation', { name: 'Project links' })
  expect(within(footer).getByRole('link', { name: 'Source on GitHub' })).toHaveAttribute(
    'href',
    'https://github.com/pkulkark/2waymirror',
  )
  expect(within(footer).getByRole('link', { name: 'Decision records' })).toHaveAttribute(
    'href',
    'https://github.com/pkulkark/2waymirror/tree/main/docs/adr',
  )
  expect(
    (await within(footer).findByRole('link', { name: 'Feedback on this page' })).getAttribute(
      'href',
    ),
  ).toBe('mailto:jordan@example.com')
  expect(screen.queryByRole('link', { name: 'How this page was made' })).not.toBeInTheDocument()
})

test('sections start open and can be independently collapsed and reopened with the keyboard', async () => {
  const user = userEvent.setup()
  const { container } = renderPage()
  const trigger = screen.getByRole('button', { name: 'How it works' })
  const body = container.querySelector(`[id="${trigger.getAttribute('aria-controls')}"]`)
  expect(trigger).toHaveAttribute('aria-expanded', 'true')
  trigger.focus()
  await user.keyboard('{Enter}')
  expect(trigger).toHaveAttribute('aria-expanded', 'false')
  expect(body).toHaveAttribute('inert')
  expect(screen.getByRole('button', { name: /Three decisions/ })).toHaveAttribute(
    'aria-expanded',
    'true',
  )
  await user.keyboard(' ')
  expect(trigger).toHaveAttribute('aria-expanded', 'true')
  expect(body).not.toHaveAttribute('inert')
})

test('offers the feedback address served from the private content', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(siteResponse({ feedback_email: 'jordan@example.com' }))
  vi.stubGlobal('fetch', fetchMock)
  renderPage()

  const link = await screen.findByRole('link', { name: 'Feedback on this page' })
  expect(link).toHaveAttribute('href', 'mailto:jordan@example.com')
  expect(fetchMock).toHaveBeenCalledWith('/api/site')
})

test('shows no feedback link when the content has no address or the request fails', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(siteResponse({ feedback_email: null })))
  renderPage()
  await waitFor(() => {
    expect(screen.getByRole('link', { name: 'Source on GitHub' })).toBeInTheDocument()
  })
  expect(screen.queryByRole('link', { name: 'Feedback on this page' })).not.toBeInTheDocument()

  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
  renderPage()
  await waitFor(() => {
    expect(screen.getAllByRole('link', { name: 'Source on GitHub' }).length).toBe(2)
  })
  expect(screen.queryByRole('link', { name: 'Feedback on this page' })).not.toBeInTheDocument()
})
