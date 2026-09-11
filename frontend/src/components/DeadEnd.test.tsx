import { render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, test } from 'vitest'

import DeadEnd from '@/components/DeadEnd'

function renderDeadEnd(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('DeadEnd', () => {
  test('centers the title and the message on a 560px card under the wordmark bar', () => {
    const { container } = renderDeadEnd(
      <DeadEnd title="This link does not match a session">
        Check the address you were sent.
      </DeadEnd>,
    )

    expect(screen.getByRole('heading', { name: 'This link does not match a session' })).toHaveClass(
      'font-serif',
      'text-[28px]',
    )
    expect(screen.getByText('Check the address you were sent.')).toHaveClass(
      'font-serif',
      'text-[17px]',
    )
    // No name given, so the bar keeps the wordmark.
    expect(screen.getByRole('heading', { name: '2WayMirror' })).toBeInTheDocument()
    expect(screen.getByText('Built by the candidate.')).toBeInTheDocument()

    const card = container.querySelector('main > div')
    expect(card).toHaveClass('w-[560px]', 'mx-auto', 'mt-[72px]', 'p-12', 'rounded-lg', 'border')
  })

  test('names the candidate in the bar and renders the action under the message', () => {
    renderDeadEnd(
      <DeadEnd
        name="Jordan Sample"
        title="This link has expired"
        action={<a href="mailto:jordan@example.com">Email Jordan Sample</a>}
      >
        It stopped working.
      </DeadEnd>,
    )

    expect(screen.getByRole('heading', { name: 'Jordan Sample' })).toBeInTheDocument()
    expect(screen.queryByText('2WayMirror')).not.toBeInTheDocument()
    const action = screen.getByRole('link', { name: 'Email Jordan Sample' })
    expect(action).toHaveAttribute('href', 'mailto:jordan@example.com')
    // 24px below the message, per the brief.
    expect(action.parentElement).toHaveClass('mt-6')
  })

  test('leaves the action out when there is nothing to offer', () => {
    const { container } = renderDeadEnd(<DeadEnd title="No way out">Nothing to do here.</DeadEnd>)

    expect(container.querySelector('main > div > div')).toBeNull()
    expect(screen.queryByRole('link', { name: /Email/ })).not.toBeInTheDocument()
  })
})
