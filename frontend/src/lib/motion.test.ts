import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { useReducedMotion } from '@/lib/motion'

interface FakeQuery {
  matches: boolean
  listeners: ((event: MediaQueryListEvent) => void)[]
  removed: number
}

function stubMatchMedia(matches: boolean): FakeQuery {
  const query: FakeQuery = { matches, listeners: [], removed: 0 }
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: query.matches,
      addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
        query.listeners.push(listener)
      },
      removeEventListener: () => {
        query.removed += 1
      },
    })),
  )
  return query
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useReducedMotion', () => {
  test('is false when the browser does not ask for reduced motion', () => {
    const { result } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(false)
  })

  test('is false when the browser has no matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined)
    const { result } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(false)
  })

  test('reads the query, follows changes, and unsubscribes', () => {
    const query = stubMatchMedia(true)
    const { result, unmount } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(true)

    act(() => {
      query.listeners.forEach((listener) => listener({ matches: false } as MediaQueryListEvent))
    })
    expect(result.current).toBe(false)

    unmount()
    expect(query.removed).toBe(1)
  })
})
