import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'

import HowIBuiltIt from './HowIBuiltIt'

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

test('each decision links to its own record and describes the rejected alternative', () => {
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
    within(footer).getByRole('link', { name: 'Feedback on this page' }).getAttribute('href'),
  ).toMatch(/^mailto:/)
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
