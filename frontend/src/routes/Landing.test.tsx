import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { test, expect } from 'vitest'

import Landing from '@/routes/Landing'

test('renders the explanation and a link to the how-i-built-it page', () => {
  render(
    <MemoryRouter>
      <Landing />
    </MemoryRouter>,
  )
  expect(screen.getByRole('heading', { name: '2WayMirror' })).toBeInTheDocument()
  expect(screen.getByText(/screening call in reverse/i)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /how this was built/i })).toHaveAttribute(
    'href',
    '/how-i-built-it',
  )
})
