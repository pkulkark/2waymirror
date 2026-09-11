import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import { FootnoteLink } from '@/components/FootnoteLink'

describe('FootnoteLink', () => {
  test('renders an evidence href as a labelled superscript marker', () => {
    const { container } = render(<FootnoteLink href="#evidence-why-leaving-2">2</FootnoteLink>)

    const marker = screen.getByRole('link', { name: 'Evidence 2' })
    expect(marker).toHaveAttribute('href', '#evidence-why-leaving-2')
    expect(marker).toHaveTextContent('2')
    expect(marker).toHaveClass('text-moss')
    expect(container.querySelector('sup')).toContainElement(marker)
  })

  test('renders any other href as a normal anchor', () => {
    const { container } = render(<FootnoteLink href="https://example.com">Elsewhere</FootnoteLink>)

    const link = screen.getByRole('link', { name: 'Elsewhere' })
    expect(link).toHaveAttribute('href', 'https://example.com')
    expect(link).toHaveClass('underline')
    expect(container.querySelector('sup')).toBeNull()
  })

  test('renders a link with no href as a normal anchor', () => {
    const { container } = render(<FootnoteLink>Bare</FootnoteLink>)

    expect(screen.getByText('Bare').tagName).toBe('A')
    expect(container.querySelector('sup')).toBeNull()
  })

  test('drops the mdast node react-markdown passes rather than putting it on the anchor', () => {
    render(
      <FootnoteLink href="https://example.com" node={{ type: 'element' }}>
        Elsewhere
      </FootnoteLink>,
    )

    expect(screen.getByRole('link', { name: 'Elsewhere' })).not.toHaveAttribute('node')
  })
})
