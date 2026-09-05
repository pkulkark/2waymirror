import { Link } from 'react-router-dom'

export default function Landing() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">2WayMirror</h1>
      <p className="text-muted-foreground mt-4 text-base leading-relaxed">
        2WayMirror is a screening call in reverse: a candidate publishes a private link that walks a
        recruiter or hiring manager through the questions an initial call would cover, in the
        candidate&apos;s own words, with the same questions the candidate would ask answered up
        front too. Anyone with the link can read it and submit their own questions for the candidate
        to answer next.
      </p>
      <p className="mt-8">
        <Link to="/how-i-built-it" className="text-primary underline underline-offset-4">
          How this was built
        </Link>
      </p>
    </main>
  )
}
