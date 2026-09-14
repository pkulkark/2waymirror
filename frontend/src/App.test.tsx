import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, test, expect, vi } from 'vitest'

import App from '@/App'

afterEach(() => {
  vi.unstubAllGlobals()
  window.history.pushState({}, '', '/')
})

test('renders the public build story at / without fetching private session content', () => {
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  render(<App />)
  expect(
    screen.getByRole('heading', { level: 1, name: 'Another company. Another initial call.' }),
  ).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'View source' })).toHaveAttribute(
    'href',
    'https://github.com/pkulkark/2waymirror',
  )
  expect(fetchMock).not.toHaveBeenCalled()
})

test('the old write-up address redirects to the root using replacement navigation', async () => {
  window.history.pushState({}, '', '/how-i-built-it')
  const entries = window.history.length
  render(<App />)
  await waitFor(() => expect(window.location.pathname).toBe('/'))
  expect(window.history.length).toBe(entries)
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Another company.')
})
