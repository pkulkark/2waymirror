import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, test } from 'vitest'

import AppBar from '@/components/AppBar'
import Page from '@/components/Page'

describe('Page', () => {
  test('frames the app bar, the content column, and the footer on the ground', () => {
    const { container } = render(
      <MemoryRouter>
        <Page appBar={<AppBar name="Jordan Sample" />}>
          <p>Content</p>
        </Page>
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Jordan Sample' })).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveTextContent('Content')
    expect(container.firstElementChild).toHaveClass('bg-ground', 'min-h-screen')
  })
})
