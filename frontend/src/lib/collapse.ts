import { useId, useState } from 'react'

import { useReducedMotion } from '@/lib/motion'

export interface CollapseTriggerProps {
  type: 'button'
  'aria-expanded': boolean
  'aria-controls': string
  onClick: () => void
}

export interface CollapseBodyState {
  id: string
  open: boolean
  reducedMotion: boolean
}

export interface Collapse {
  /** True while the body is visible. Always true when the collapse is not collapsible. */
  isOpen: boolean
  /** True when the reader asked for reduced motion, so callers drop their own transitions too. */
  reducedMotion: boolean
  /** Spread on the button that toggles the body. */
  triggerProps: CollapseTriggerProps
  /** Spread on `CollapseBody`. */
  bodyProps: CollapseBodyState
}

export interface UseCollapseOptions {
  defaultOpen?: boolean
  /** False pins the body open and leaves the caller to skip the trigger. */
  collapsible?: boolean
}

/**
 * The disclosure mechanics shared by Surface and Answer: the open state, the id that ties the
 * trigger to the body, and the reduced-motion flag the animation asks about. The markup around
 * it differs per component, so only the wiring lives here; `CollapseChevron` and `CollapseBody`
 * in components/Collapse.tsx render the parts that are the same in both.
 */
export function useCollapse({
  defaultOpen = true,
  collapsible = true,
}: UseCollapseOptions = {}): Collapse {
  const [open, setOpen] = useState(defaultOpen)
  const reducedMotion = useReducedMotion()
  const bodyId = useId()
  const isOpen = collapsible ? open : true

  return {
    isOpen,
    reducedMotion,
    triggerProps: {
      type: 'button',
      'aria-expanded': isOpen,
      'aria-controls': bodyId,
      onClick: () => setOpen((previous) => !previous),
    },
    bodyProps: { id: bodyId, open: isOpen, reducedMotion },
  }
}
