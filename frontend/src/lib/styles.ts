/**
 * Class strings shared by more than one component, so that a rule the design system states once
 * is written down once.
 */

/**
 * The 2px moss focus ring with a 2px offset that design-system.md ("Controls") asks of every
 * control, link or button. Written once here so a new control cannot drift.
 */
export const FOCUS_RING =
  'focus-visible:outline-moss focus-visible:outline-2 focus-visible:outline-offset-2'

/**
 * Every link outside the app bar: moss text, the darker moss on hover, an underline clear of the
 * descenders, and the shared focus ring. Add sizing and weight beside it; do not restate the
 * colour or the ring.
 */
export const TEXT_LINK = `text-moss hover:text-moss-hover underline underline-offset-2 ${FOCUS_RING}`
