import { render } from '@testing-library/react'
import ReactMarkdown from 'react-markdown'
import { describe, expect, test } from 'vitest'

import { evidenceAnchorId, remarkFootnoteLinks } from '@/lib/footnotes'

/**
 * The plugin is only meaningful against a real parse, so every case here goes through
 * react-markdown. Markers become plain anchors carrying `data-footnote`; FootnoteLink.tsx is
 * what turns those into superscripts, and is tested separately.
 */
function renderMarkdown(markdown: string, { itemId = 'why-leaving', evidenceCount = 2 } = {}) {
  const { container } = render(
    <ReactMarkdown remarkPlugins={[[remarkFootnoteLinks, { itemId, evidenceCount }]]}>
      {markdown}
    </ReactMarkdown>,
  )
  return container
}

function markers(container: HTMLElement): HTMLAnchorElement[] {
  return [...container.querySelectorAll<HTMLAnchorElement>('a[data-footnote]')]
}

describe('evidenceAnchorId', () => {
  test('names the nth evidence row of an answer', () => {
    expect(evidenceAnchorId('why-leaving', 2)).toBe('evidence-why-leaving-2')
  })

  test('keeps an id that already ends in a digit distinct from the position', () => {
    expect(evidenceAnchorId('q2', 1)).toBe('evidence-q2-1')
    expect(evidenceAnchorId('q-2', 1)).toBe('evidence-q-2-1')
  })
})

describe('remarkFootnoteLinks', () => {
  test('turns a marker in prose into a link at the matching evidence row', () => {
    const container = renderMarkdown('A claim[^1].')

    const [marker] = markers(container)
    expect(marker).toHaveAttribute('href', '#evidence-why-leaving-1')
    expect(marker).toHaveAttribute('data-footnote', '1')
    expect(marker).toHaveTextContent('1')
    expect(container.querySelector('p')).toHaveTextContent('A claim1.')
  })

  test('turns every marker in a paragraph into its own link', () => {
    const container = renderMarkdown('One[^1] and two[^2] and one again[^1].')

    expect(markers(container).map((marker) => marker.getAttribute('href'))).toEqual([
      '#evidence-why-leaving-1',
      '#evidence-why-leaving-2',
      '#evidence-why-leaving-1',
    ])
  })

  test('leaves prose without markers untouched', () => {
    const container = renderMarkdown('No markers here.')

    expect(markers(container)).toHaveLength(0)
    expect(container.querySelector('p')).toHaveTextContent('No markers here.')
  })

  test('leaves a marker inside an inline code span as written', () => {
    const container = renderMarkdown('Write `[^1]` to cite the first item.')

    expect(markers(container)).toHaveLength(0)
    expect(container.querySelector('code')).toHaveTextContent('[^1]')
  })

  test.each([
    ['a backtick fence', '```md\nA claim[^1].\n```'],
    ['a tilde fence', '~~~md\nA claim[^1].\n~~~'],
  ])('leaves a marker inside %s as written', (_label, fence) => {
    const container = renderMarkdown(`Like so:\n\n${fence}\n\nAnd a real one[^2].`)

    expect(container.querySelector('pre code')).toHaveTextContent('A claim[^1].')
    expect(markers(container).map((marker) => marker.getAttribute('href'))).toEqual([
      '#evidence-why-leaving-2',
    ])
  })

  test('leaves a marker inside a link label as written', () => {
    const container = renderMarkdown('See [the note [^1]](https://example.com/note).')

    expect(markers(container)).toHaveLength(0)
    const link = container.querySelector('a')
    expect(link).toHaveAttribute('href', 'https://example.com/note')
    expect(link).toHaveTextContent('the note [^1]')
  })

  test('leaves a marker inside a reference link label as written', () => {
    const container = renderMarkdown('See [the note [^1]][ref].\n\n[ref]: https://example.com/note')

    expect(markers(container)).toHaveLength(0)
    const link = container.querySelector('a')
    expect(link).toHaveAttribute('href', 'https://example.com/note')
    expect(link).toHaveTextContent('the note [^1]')
  })

  test('still rewrites a marker that follows a link', () => {
    const container = renderMarkdown('See [the note](https://example.com/note)[^1].')

    expect(markers(container)).toHaveLength(1)
    expect(markers(container)[0]).toHaveAttribute('href', '#evidence-why-leaving-1')
  })

  test('a marker after an exclamation mark is a marker, not an image', () => {
    const container = renderMarkdown('Really![^1]')

    expect(container.querySelector('img')).toBeNull()
    expect(markers(container)[0]).toHaveAttribute('href', '#evidence-why-leaving-1')
    expect(container.querySelector('p')).toHaveTextContent('Really!1')
  })

  test.each([
    ['past the end of the evidence list', 'A claim[^3].'],
    ['at position zero', 'A claim[^0].'],
  ])('leaves a marker %s as written', (_label, markdown) => {
    const container = renderMarkdown(markdown)

    expect(markers(container)).toHaveLength(0)
    expect(container.querySelector('p')).toHaveTextContent(markdown)
  })

  test('leaves every marker alone when the answer has no evidence', () => {
    const container = renderMarkdown('A claim[^1].', { evidenceCount: 0 })

    expect(markers(container)).toHaveLength(0)
    expect(container.querySelector('p')).toHaveTextContent('A claim[^1].')
  })

  test('needs no escaping for an item id holding a space', () => {
    const container = renderMarkdown('A claim[^1].', { itemId: 'why leaving' })

    // The href is percent-encoded on the way into the DOM; the anchor id itself keeps the space.
    expect(markers(container)[0]).toHaveAttribute('href', '#evidence-why%20leaving-1')
    expect(evidenceAnchorId('why leaving', 1)).toBe('evidence-why leaving-1')
  })

  test('needs no escaping for an item id holding parentheses', () => {
    const container = renderMarkdown('A claim[^1].', { itemId: 'plan-(b)' })

    expect(markers(container)[0]).toHaveAttribute('href', '#evidence-plan-(b)-1')
  })
})
