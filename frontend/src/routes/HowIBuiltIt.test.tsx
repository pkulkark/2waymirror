import { render, screen } from '@testing-library/react'
import { test, expect } from 'vitest'

import HowIBuiltIt from '@/routes/HowIBuiltIt'

test('renders a heading and a placeholder sentence', () => {
  render(<HowIBuiltIt />)
  expect(screen.getByRole('heading', { name: 'How I built it' })).toBeInTheDocument()
  expect(screen.getByText(/write-up is coming/i)).toBeInTheDocument()
})
