import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, test } from 'vitest'

import AppBar, { type AppBarProps } from '@/components/AppBar'

function renderAppBar(props: AppBarProps = {}, route = '/s/tok123') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AppBar {...props} />
    </MemoryRouter>,
  )
}

describe('AppBar', () => {
  test('shows the wordmark and nothing else when no session is loaded', () => {
    renderAppBar()

    expect(screen.getByRole('heading', { name: '2WayMirror' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  test('shows the name, headline, and both chips', () => {
    renderAppBar({
      name: 'Jordan Sample',
      headline: 'Backend engineer, distributed systems',
      statusChip: '0 of 2 required answered',
      sessionChip: 'Acme Corp, until 15 Sep',
    })

    expect(screen.getByRole('heading', { name: 'Jordan Sample' })).toBeInTheDocument()
    expect(screen.getByText('Backend engineer, distributed systems')).toBeInTheDocument()
    expect(screen.getByText('0 of 2 required answered')).toBeInTheDocument()
    expect(screen.getByText('Acme Corp, until 15 Sep')).toBeInTheDocument()
  })

  test('renders a profile link per entry, opening the web ones in a new tab', () => {
    const { container } = renderAppBar({
      name: 'Jordan Sample',
      links: [
        { label: 'Email', url: 'mailto:jordan@example.com' },
        { label: 'GitHub', url: 'https://github.com/jordan' },
        { label: 'LinkedIn', url: 'https://linkedin.com/in/jordan' },
        { label: 'Portfolio', url: 'https://jordan.example.com' },
      ],
    })

    expect(screen.getByRole('link', { name: 'Email' })).toHaveAttribute(
      'href',
      'mailto:jordan@example.com',
    )
    expect(screen.getByRole('link', { name: 'Email' })).not.toHaveAttribute('target')
    expect(screen.getByRole('link', { name: 'GitHub' })).toHaveAttribute('target', '_blank')
    expect(screen.getByRole('link', { name: 'LinkedIn' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Portfolio' })).toBeInTheDocument()
    // One stroke icon per link, each a different glyph.
    const icons = container.querySelectorAll('nav svg')
    expect(icons).toHaveLength(4)
    expect(new Set([...icons].map((icon) => icon.getAttribute('class'))).size).toBe(4)
  })

  test('marks the tab matching the current route as active and shows counts', () => {
    renderAppBar({
      name: 'Jordan Sample',
      tabs: [
        { id: 'intro', label: 'Screening', count: 5, to: '/s/tok123' },
        { id: 'behavioral', label: 'Behavioral', count: 6, to: '/s/tok123/behavioral' },
      ],
    })

    const active = screen.getByRole('link', { name: /Screening/ })
    expect(active).toHaveAttribute('href', '/s/tok123')
    expect(active).toHaveAttribute('aria-current', 'page')
    expect(active).toHaveTextContent('5')

    const inactive = screen.getByRole('link', { name: /Behavioral/ })
    expect(inactive).toHaveAttribute('href', '/s/tok123/behavioral')
    expect(inactive).not.toHaveAttribute('aria-current')
    expect(inactive).toHaveTextContent('6')
  })

  test('names the count pill for screen readers', () => {
    renderAppBar({
      name: 'Jordan Sample',
      tabs: [
        { id: 'intro', label: 'Screening', count: 1, to: '/s/tok123' },
        { id: 'behavioral', label: 'Behavioral', count: 6, to: '/s/tok123/behavioral' },
      ],
    })

    expect(screen.getByRole('link', { name: /Screening\s*1 answer/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Behavioral\s*6 answers/ })).toBeInTheDocument()
  })

  test('activates a later tab when the route points at it', () => {
    renderAppBar(
      {
        name: 'Jordan Sample',
        tabs: [
          { id: 'intro', label: 'Screening', count: 5, to: '/s/tok123' },
          { id: 'behavioral', label: 'Behavioral', count: 6, to: '/s/tok123/behavioral' },
        ],
      },
      '/s/tok123/behavioral',
    )

    expect(screen.getByRole('link', { name: /Behavioral/ })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: /Screening/ })).not.toHaveAttribute('aria-current')
  })
})
