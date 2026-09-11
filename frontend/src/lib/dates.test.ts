import { describe, expect, test } from 'vitest'

import { isIsoDate } from '@/lib/dates'

describe('isIsoDate', () => {
  test.each(['2026-09-15T00:00:00Z', '2026-09-15T12:30:45.123456+02:00', '2026-09-15'])(
    'accepts the ISO timestamps the backend sends: %s',
    (value) => {
      expect(isIsoDate(value)).toBe(true)
    },
  )

  test.each([
    ['a bare number', '42'],
    ['prose', '15 September'],
    ['an ISO shape that does not parse', '2026-13-45T00:00:00Z'],
    ['an empty string', ''],
    ['a year on its own', '2026'],
  ])('rejects %s', (_label, value) => {
    expect(isIsoDate(value)).toBe(false)
  })

  test.each([[null], [undefined], [42], [{ toString: () => '2026-09-15' }]])(
    'rejects anything that is not a string: %s',
    (value) => {
      expect(isIsoDate(value)).toBe(false)
    },
  )
})
