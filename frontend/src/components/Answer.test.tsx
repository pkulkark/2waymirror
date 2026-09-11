import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'

import type { SectionItem } from '@/api'
import Answer from '@/components/Answer'

function item(overrides: Partial<SectionItem> = {}): SectionItem {
  return {
    id: 'migration',
    question: 'Tell me about a project you are proud of.',
    summary: 'Led a sharded queue migration.',
    answer_md: 'I led the migration to a **sharded** setup.',
    evidence: [{ label: 'Public writeup', url: 'https://example.com/writeup', type: 'writeup' }],
    ...overrides,
  }
}

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

/** The one div react-markdown renders into: the prose type and the code rules hang off it. */
function prose(container: HTMLElement): HTMLElement {
  const wrapper = container.querySelector<HTMLElement>('div.font-serif')
  if (!wrapper) throw new Error('expected a prose wrapper')
  return wrapper
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Answer', () => {
  test('renders the question as a heading, the summary, and the prose, and starts open', () => {
    render(<Answer item={item()} />)

    const heading = screen.getByRole('heading', { level: 3 })
    expect(heading).toHaveTextContent('Tell me about a project you are proud of.')
    expect(screen.getByText('Led a sharded queue migration.')).toBeInTheDocument()
    expect(screen.getByText('sharded').tagName).toBe('STRONG')
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true')
  })

  test('styles the Markdown the prose is allowed to use', () => {
    const markdown = [
      'A *stressed* claim with `inline code`.',
      '',
      '- first bullet',
      '- second bullet',
      '',
      '1. first step',
      '2. second step',
      '',
      'See the [upstream note](https://example.com/note).',
    ].join('\n')
    const { container } = render(<Answer item={item({ answer_md: markdown })} />)

    expect(screen.getByText('stressed').tagName).toBe('EM')
    expect(screen.getByText('inline code').tagName).toBe('CODE')
    // The prose type is set once on the wrapper, and inline code is styled by selector from it.
    expect(prose(container)).toHaveClass('text-ink', 'font-serif', 'text-[17px]')
    expect(prose(container).className).toContain('[&_:not(pre)>code]:font-sans')
    expect(screen.getByText('first bullet').closest('ul')).toHaveClass('list-disc')
    expect(screen.getByText('first step').closest('ol')).toHaveClass('list-decimal')
    const link = screen.getByRole('link', { name: 'upstream note' })
    expect(link).toHaveClass('text-moss')
    expect(link.closest('sup')).toBeNull()
  })

  test('renders a fenced code block as a monospace pre, styled from the wrapper', () => {
    const markdown = ['Like so:', '', '```py', 'print("hi")', '```'].join('\n')
    const { container } = render(<Answer item={item({ answer_md: markdown })} />)

    const block = container.querySelector('pre code')
    expect(block).toHaveTextContent('print("hi")')
    expect(prose(container).className).toContain('[&_pre]:font-mono')
    // The inline-code rule must not reach the code inside a pre.
    expect(prose(container).className).toContain('[&_:not(pre)>code]')
  })

  test('renders a heading in the body one level below the question heading', () => {
    const markdown = ['## The migration', '', 'It went fine.'].join('\n')
    render(<Answer item={item({ answer_md: markdown })} />)

    const heading = screen.getByRole('heading', { name: 'The migration' })
    expect(heading.tagName).toBe('H4')
    expect(heading).toHaveClass('font-serif', 'text-[20px]', 'font-medium')
  })

  test('styles a blockquote and a rule', () => {
    const markdown = ['> A quoted line.', '', '---', '', 'After.'].join('\n')
    const { container } = render(<Answer item={item({ answer_md: markdown })} />)

    expect(container.querySelector('blockquote')).toHaveClass('border-l-2', 'text-muted-ink')
    expect(container.querySelector('hr')).toHaveClass('border-hairline')
  })

  test('leaves out the summary when the answer has none', () => {
    render(<Answer item={item({ summary: undefined })} />)

    expect(screen.queryByText('Led a sharded queue migration.')).not.toBeInTheDocument()
  })

  test('counts the evidence in the header row, with no plural on the noun', () => {
    const four: SectionItem['evidence'] = [1, 2, 3, 4].map((n) => ({
      label: `Item ${n}`,
      url: `https://example.com/${n}`,
    }))

    const { rerender } = render(<Answer item={item()} />)
    expect(screen.getByText('1 evidence')).toBeInTheDocument()

    rerender(<Answer item={item({ evidence: four })} />)
    expect(screen.getByText('4 evidence')).toBeInTheDocument()
  })

  test('shows no count and no evidence block when there is no evidence', () => {
    render(<Answer item={item({ evidence: [] })} />)

    expect(screen.queryByText(/evidence$/i)).not.toBeInTheDocument()
    expect(screen.queryByText('Evidence')).not.toBeInTheDocument()
  })

  test('the header row toggles the body and points at it', async () => {
    const user = userEvent.setup()
    const { container } = render(<Answer item={item()} />)

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
    const { container } = render(<Answer item={item()} defaultOpen={false} />)

    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false')
    expect(container.querySelector('[data-state]')).toHaveAttribute('data-state', 'closed')
  })

  test('renders one evidence row per item, each with its anchor id and type word', () => {
    const { container } = render(
      <Answer
        item={item({
          evidence: [
            { label: 'Public writeup', url: 'https://example.com/writeup', type: 'writeup' },
            { label: 'Upstream pull request', url: 'https://example.com/pr', type: 'pr' },
            { label: 'No type', url: 'https://example.com/plain' },
          ],
        })}
      />,
    )

    expect(screen.getByText('Evidence')).toBeInTheDocument()
    const rows = screen.getAllByRole('listitem')
    expect(rows).toHaveLength(3)
    expect(rows[0]).toHaveAttribute('id', 'evidence-migration-1')
    expect(rows[1]).toHaveAttribute('id', 'evidence-migration-2')
    expect(rows[2]).toHaveAttribute('id', 'evidence-migration-3')
    expect(within(rows[0]).getByText('1')).toBeInTheDocument()
    expect(within(rows[0]).getByText('writeup')).toBeInTheDocument()
    expect(within(rows[1]).getByText('pr')).toBeInTheDocument()
    // An untyped item shows the link alone, with no trailing type word.
    expect(rows[2].textContent).toBe('3No type')

    const link = within(rows[0]).getByRole('link', { name: 'Public writeup' })
    expect(link).toHaveAttribute('href', 'https://example.com/writeup')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noreferrer')
    // The old "Writeup: " prefix form is gone.
    expect(container.textContent).not.toContain('Writeup:')
  })

  test('turns a footnote marker in the prose into a superscript link at the evidence row', () => {
    const { container } = render(
      <Answer
        item={item({
          answer_md: 'I led the migration[^1], with no downtime.',
        })}
      />,
    )

    const marker = screen.getByRole('link', { name: 'Evidence 1' })
    expect(marker).toHaveAttribute('href', '#evidence-migration-1')
    expect(marker).toHaveTextContent('1')
    expect(marker.closest('sup')).not.toBeNull()
    expect(container.querySelector('#evidence-migration-1')).not.toBeNull()
  })

  test('leaves a marker inside inline code and inside a link label as the author typed it', () => {
    render(
      <Answer
        item={item({
          answer_md: 'Write `[^1]` to cite [the note [^1]](https://example.com/note).',
        })}
      />,
    )

    expect(screen.getByText('[^1]').tagName).toBe('CODE')
    expect(screen.getByRole('link', { name: 'the note [^1]' })).toHaveAttribute(
      'href',
      'https://example.com/note',
    )
    expect(screen.queryByRole('link', { name: 'Evidence 1' })).not.toBeInTheDocument()
  })

  test('leaves a marker with no matching evidence item as written', () => {
    render(<Answer item={item({ answer_md: 'I led the migration[^2].' })} />)

    expect(screen.getByText('I led the migration[^2].')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Evidence 2' })).not.toBeInTheDocument()
  })

  test('drops the transitions under prefers-reduced-motion', () => {
    stubReducedMotion()
    const { container } = render(<Answer item={item()} />)

    const body = container.querySelector('[data-state]')
    expect(body?.className).not.toContain('transition-')
    expect(container.querySelector('svg')?.getAttribute('class')).not.toContain('transition-')
  })

  test('keeps the transitions when motion is allowed', () => {
    const { container } = render(<Answer item={item()} />)

    expect(container.querySelector('[data-state]')?.className).toContain(
      'transition-[grid-template-rows]',
    )
    expect(container.querySelector('svg')?.getAttribute('class')).toContain('transition-transform')
  })
})
