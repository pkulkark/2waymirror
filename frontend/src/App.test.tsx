import { render, screen } from '@testing-library/react'
import { afterEach, test, expect, vi } from 'vitest'

import App from '@/App'

afterEach(() => {
  vi.unstubAllGlobals()
  window.history.pushState({}, '', '/')
})

test('renders the landing page at /', () => {
  vi.stubGlobal('fetch', vi.fn())
  render(<App />)
  expect(screen.getByRole('heading', { name: '2WayMirror' })).toBeInTheDocument()
})
