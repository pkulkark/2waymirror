import { Link } from 'react-router-dom'

import { TEXT_LINK } from '@/lib/styles'

/** The page footer: a link to the build write-up. */
export default function Footer() {
  return (
    <footer className="text-muted-ink mx-auto flex w-[960px] items-center justify-center gap-1.5 py-10 text-[13px] leading-[1.4]">
      <Link to="/" className={TEXT_LINK}>
        How this page was made
      </Link>
    </footer>
  )
}
