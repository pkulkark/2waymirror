import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, test } from 'vitest'

import LoadingSkeleton from '@/components/LoadingSkeleton'

function renderSkeleton() {
  return render(
    <MemoryRouter>
      <LoadingSkeleton />
    </MemoryRouter>,
  )
}

function blocks(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[data-slot="skeleton"]'))
}

describe('LoadingSkeleton', () => {
  test('mirrors the app bar: name, two chips, headline, links, tabs', () => {
    const { container } = renderSkeleton()
    const bar = container.querySelector('header')

    expect(bar).toHaveClass('bg-dark', 'sticky')
    const barBlocks = blocks(bar as HTMLElement)
    // One name, two chips, one headline, three links, three tabs.
    expect(barBlocks).toHaveLength(10)
    barBlocks.forEach((block) => expect(block).toHaveClass('bg-skeleton-on-dark'))

    expect(barBlocks[0]).toHaveClass('h-5', 'w-[140px]')
    expect(barBlocks[1]).toHaveClass('h-7', 'w-[160px]', 'rounded-full')
    expect(barBlocks[2]).toHaveClass('h-7', 'w-[160px]', 'rounded-full')
    // The headline and link blocks reserve the height of the text they stand in for.
    expect(barBlocks[3]).toHaveClass('h-[21px]', 'w-[360px]')
    expect(barBlocks.slice(4, 7).map((b) => b.className)).toEqual(
      Array(3).fill(barBlocks[4].className),
    )
    expect(barBlocks[4]).toHaveClass('h-[21px]', 'w-[70px]')
    // The tabs take the widths of the labels they stand in for.
    expect(barBlocks.slice(7, 10).map((b) => b.className.match(/w-\[(\d+)px\]/)?.[1])).toEqual([
      '90',
      '90',
      '120',
    ])
    barBlocks.slice(7, 10).forEach((tab) => expect(tab).toHaveClass('h-[15px]'))
    // The headline and links sit in the same column the real bar gives them.
    expect(barBlocks[3].parentElement).toHaveClass('gap-2.5', 'pb-4')
    // The tabs row keeps the bar's 44px height.
    expect(barBlocks[7].parentElement).toHaveClass('h-11')
  })

  test('stands in for two surfaces: four logistics rows, then six lines of prose', () => {
    const { container } = renderSkeleton()
    const surfaces = container.querySelectorAll('main section')

    expect(surfaces).toHaveLength(2)
    surfaces.forEach((surface) => {
      const header = surface.firstElementChild
      expect(header).toHaveClass('bg-moss-tint', 'h-[52px]')
      expect(header?.firstElementChild).toHaveClass('h-6', 'w-[200px]')
    })

    const rows = surfaces[0].querySelectorAll('.border-hairline')
    expect(rows).toHaveLength(4)
    // A 13px label at 1.4 and a 17px value at 1.4: the heights of the real logistics row.
    expect(rows[0]).toHaveClass('gap-1', 'py-3.5')
    expect(rows[0].children[0]).toHaveClass('h-[18px]', 'w-[90px]')
    expect(rows[0].children[1]).toHaveClass('h-6', 'w-[320px]')

    const lines = blocks(surfaces[1] as HTMLElement).slice(1)
    expect(lines.map((line) => line.className.match(/w-\[(\d+)px\]/)?.[1])).toEqual([
      '680',
      '660',
      '640',
      '600',
      '620',
      '400',
    ])
    lines.forEach((line) => expect(line).toHaveClass('h-3.5'))
  })

  test('announces itself as busy and keeps the bar out of the reading order', () => {
    const { container } = renderSkeleton()

    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
    expect(screen.getByText('Loading')).toHaveClass('sr-only')
    expect(screen.getByText('Loading')).toHaveAttribute('aria-live', 'polite')
    expect(container.querySelector('header')).toHaveAttribute('aria-hidden', 'true')
  })

  test('pulses over 1.6s and holds still under reduced motion', () => {
    const { container } = renderSkeleton()

    blocks(container).forEach((block) => {
      expect(block).toHaveClass('animate-pulse', '[animation-duration:1.6s]')
      expect(block).toHaveClass('motion-reduce:animate-none')
    })
  })
})
