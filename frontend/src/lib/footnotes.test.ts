import { describe, expect, test } from 'vitest'

import { evidenceAnchorId, footnotePosition, linkFootnotes } from '@/lib/footnotes'

describe('evidenceAnchorId', () => {
  test('names the nth evidence row of an answer', () => {
    expect(evidenceAnchorId('why-leaving', 2)).toBe('evidence-why-leaving-2')
  })

  test('keeps an id that already ends in a digit distinct from the position', () => {
    expect(evidenceAnchorId('q2', 1)).toBe('evidence-q2-1')
    expect(evidenceAnchorId('q-2', 1)).toBe('evidence-q-2-1')
  })
})

describe('footnotePosition', () => {
  test('reads the position back off an href', () => {
    expect(footnotePosition('#evidence-why-leaving-2')).toBe('2')
  })

  test('reads past an id that itself ends in a digit', () => {
    expect(footnotePosition(`#${evidenceAnchorId('q2', 3)}`)).toBe('3')
    expect(footnotePosition(`#${evidenceAnchorId('q-2', 3)}`)).toBe('3')
  })

  test('reads a position of more than one digit', () => {
    expect(footnotePosition(`#${evidenceAnchorId('why-leaving', 12)}`)).toBe('12')
  })
})

describe('linkFootnotes', () => {
  test('rewrites a marker into a link at the matching evidence row', () => {
    expect(linkFootnotes('A claim[^1].', 'why-leaving', 1)).toBe(
      'A claim[1](#evidence-why-leaving-1).',
    )
  })

  test('rewrites every marker in the body', () => {
    expect(linkFootnotes('One[^1] and two[^2] and one again[^1].', 'migration', 2)).toBe(
      'One[1](#evidence-migration-1) and two[2](#evidence-migration-2) and one again[1](#evidence-migration-1).',
    )
  })

  test('leaves a marker past the end of the evidence list as written', () => {
    expect(linkFootnotes('A claim[^3].', 'why-leaving', 2)).toBe('A claim[^3].')
  })

  test('leaves a zero marker as written', () => {
    expect(linkFootnotes('A claim[^0].', 'why-leaving', 2)).toBe('A claim[^0].')
  })

  test('leaves every marker alone when the answer has no evidence', () => {
    expect(linkFootnotes('A claim[^1].', 'why-leaving', 0)).toBe('A claim[^1].')
  })

  test('leaves prose without markers untouched', () => {
    expect(linkFootnotes('No markers here.', 'why-leaving', 2)).toBe('No markers here.')
  })

  test('leaves a marker inside an inline code span as written', () => {
    expect(linkFootnotes('Write `[^1]` to cite the first item.', 'why-leaving', 2)).toBe(
      'Write `[^1]` to cite the first item.',
    )
  })

  test('leaves a marker inside a double backtick span as written', () => {
    expect(linkFootnotes('Write `` [^1] `` to cite it.', 'why-leaving', 2)).toBe(
      'Write `` [^1] `` to cite it.',
    )
  })

  test('leaves a marker inside a fenced code block as written', () => {
    const markdown = [
      'Like so:',
      '',
      '```md',
      'A claim[^1].',
      '```',
      '',
      'And a real one[^2].',
    ].join('\n')

    expect(linkFootnotes(markdown, 'why-leaving', 2)).toBe(
      markdown.replace('And a real one[^2].', 'And a real one[2](#evidence-why-leaving-2).'),
    )
  })

  test('leaves a marker inside another link label as written', () => {
    expect(linkFootnotes('See [the note [^1]](https://example.com/note).', 'why-leaving', 2)).toBe(
      'See [the note [^1]](https://example.com/note).',
    )
  })

  test('still rewrites a marker that follows a link', () => {
    expect(linkFootnotes('See [the note](https://example.com/note)[^1].', 'why-leaving', 2)).toBe(
      'See [the note](https://example.com/note)[1](#evidence-why-leaving-1).',
    )
  })

  test('still rewrites a marker that follows an inline code span', () => {
    expect(linkFootnotes('The `queue` shard[^1].', 'why-leaving', 2)).toBe(
      'The `queue` shard[1](#evidence-why-leaving-1).',
    )
  })
})
