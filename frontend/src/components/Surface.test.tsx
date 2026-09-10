import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MapPin } from 'lucide-react'
import { afterEach, describe, expect, test, vi } from 'vitest'

import Surface from '@/components/Surface'

function stubReducedMotion() {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: true,
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Surface', () => {
  test('renders the title, icon, and count, and starts open', () => {
    const { container } = render(
      <Surface title="Logistics" icon={MapPin} count="4 items">
        <p>Body copy</p>
      </Surface>,
    )

    expect(screen.getByRole('heading', { name: /Logistics/ })).toBeInTheDocument()
    expect(screen.getByText('4 items')).toBeInTheDocument()
    expect(screen.getByText('Body copy')).toBeInTheDocument()
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true')
    // The section icon plus the chevron.
    expect(container.querySelectorAll('svg')).toHaveLength(2)
  })

  test('the header button toggles the body and points at it', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <Surface title="Logistics">
        <p>Body copy</p>
      </Surface>,
    )

    const header = screen.getByRole('button')
    const bodyId = header.getAttribute('aria-controls')
    expect(bodyId).toBeTruthy()
    const body = container.querySelector(`#${CSS.escape(bodyId ?? '')}`)
    expect(body).toHaveAttribute('data-state', 'open')

    await user.click(header)
    expect(header).toHaveAttribute('aria-expanded', 'false')
    expect(body).toHaveAttribute('data-state', 'closed')

    await user.click(header)
    expect(header).toHaveAttribute('aria-expanded', 'true')
    expect(body).toHaveAttribute('data-state', 'open')
  })

  test('honours defaultOpen', () => {
    render(
      <Surface title="Logistics" defaultOpen={false}>
        <p>Body copy</p>
      </Surface>,
    )

    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false')
  })

  test('has no toggle when it is not collapsible', () => {
    const { container } = render(
      <Surface title="Logistics" collapsible={false}>
        <p>Body copy</p>
      </Surface>,
    )

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Logistics' })).toBeInTheDocument()
    expect(container.querySelectorAll('svg')).toHaveLength(0)
    expect(container.querySelector('[data-state]')).toHaveAttribute('data-state', 'open')
  })

  test('the dark variant fills with the dark tokens', () => {
    const { container } = render(
      <Surface title="Questions for you" count="0 of 2 required answered" dark>
        <p>Body copy</p>
      </Surface>,
    )

    expect(container.querySelector('section')).toHaveClass('bg-dark')
    expect(screen.getByRole('heading', { name: /Questions for you/ })).toHaveClass('bg-dark-input')
  })

  test('drops the transitions under prefers-reduced-motion', () => {
    stubReducedMotion()
    const { container } = render(
      <Surface title="Logistics">
        <p>Body copy</p>
      </Surface>,
    )

    const body = container.querySelector('[data-state]')
    expect(body?.className).not.toContain('transition-')
    expect(container.querySelector('svg')?.getAttribute('class')).not.toContain('transition-')
  })

  test('keeps the transitions when motion is allowed', () => {
    const { container } = render(
      <Surface title="Logistics">
        <p>Body copy</p>
      </Surface>,
    )

    expect(container.querySelector('[data-state]')?.className).toContain(
      'transition-[grid-template-rows]',
    )
  })
})
