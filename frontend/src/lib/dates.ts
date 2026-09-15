/**
 * Date checks shared by the API client, which has to decide whether a timestamp the backend
 * sent is worth printing.
 */

/** An ISO date prefix: four-digit year, month, day. Anything before it fails the check. */
const ISO_PREFIX = /^\d{4}-\d{2}-\d{2}/

/**
 * True when `value` is a string the page can format as a date. `Date.parse` alone is too
 * generous: it accepts "42" and, in some engines, prose like "15 September", so the value
 * has to look like an ISO timestamp as well as parse to a real instant.
 */
export function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && ISO_PREFIX.test(value) && Number.isFinite(Date.parse(value))
}
