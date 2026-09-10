import { Link } from 'react-router-dom'

/** The page footer: one line of credit and a link to the build write-up. */
export default function Footer() {
  return (
    <footer className="text-muted-ink mx-auto flex w-[960px] items-center justify-center gap-1.5 py-10 text-[13px] leading-[1.4]">
      <span>Built by the candidate.</span>
      <Link
        to="/"
        className="text-accent hover:text-accent-hover focus-visible:outline-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        How this page was made
      </Link>
    </footer>
  )
}
