/** Candidate-approved introduction to the project and its build story. */
export default function ProjectStory() {
  return (
    <section
      aria-labelledby="project-intro"
      className="mx-[37px] flex flex-col gap-4 pt-12 pb-10 font-serif text-[19px] leading-[1.55]"
    >
      <h1 id="project-intro" className="text-[30px] leading-[1.15] font-medium">
        Another company. Another initial call.
      </h1>
      <p>
        Thirty to sixty minutes on your background, what you’re looking for, and whether the
        practical details line up. A hiring manager conversation a week later. Then a technical
        round.
      </p>
      <p>
        Across the companies in your pipeline, you give the same answers, tell the same stories, and
        explain the same projects. Across their candidates, recruiters and hiring managers ask the
        same questions. Hours of conversation and weeks of scheduling can pass before either side
        discovers a mismatch.
      </p>
      <p>
        <strong className="font-medium">
          2WayMirror lets both sides do that groundwork before booking the time.
        </strong>{' '}
        A candidate prepares their answers once and shares a dedicated link with each company,
        tailored to the kind of role they’re pursuing.
      </p>
      <ul className="flex list-disc flex-col gap-1.5 pl-6">
        <li>
          <strong className="font-medium">Recruiters</strong> check background, availability,
          compensation, and practical fit.
        </li>
        <li>
          <strong className="font-medium">Hiring managers</strong> explore examples of ownership,
          collaboration, and difficult decisions.
        </li>
        <li>
          <strong className="font-medium">Engineers</strong> examine projects, code, and technical
          tradeoffs as evidence of capability.
        </li>
      </ul>
      <p>
        The exchange goes both ways. The company answers the candidate’s questions about the team,
        expectations, and working environment in the same space. Both sides get information they
        would otherwise spend calls collecting.
      </p>
      <p>
        That means less repetition, earlier decisions about fit, and fewer meetings spent
        establishing the basics. When you do meet, you can start with something specific: “I read
        about the migration you led. We’re facing something similar. Can we talk about the
        tradeoffs?”
      </p>
      <p>
        This project is my own example. Below, you can explore its architecture, the choices behind
        it, and how I used AI to build it, then decide what you’d like to ask me about.
      </p>
    </section>
  )
}
