/**
 * Class strings shared by more than one component, so that a rule the design system states once
 * is written down once.
 */

/**
 * Every link outside the app bar: moss text, the darker moss on hover, an underline clear of the
 * descenders, and the 2px moss focus ring with a 2px offset that design-system.md asks of every
 * control. Add sizing and weight beside it; do not restate the colour or the ring.
 */
export const TEXT_LINK =
  'text-moss hover:text-moss-hover focus-visible:outline-moss underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2'
