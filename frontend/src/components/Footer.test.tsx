import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, test } from 'vitest'

import Footer from '@/components/Footer'

describe('Footer', () => {
  test('credits the candidate and links to the build write-up', () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>,
    )

    expect(screen.getByText('Built by the candidate.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'How this page was made' })).toHaveAttribute(
      'href',
      '/',
    )
  })
})
