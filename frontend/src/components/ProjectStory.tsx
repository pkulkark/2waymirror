/** Candidate draft from the root-page mockup; final wording is reviewed in the PR. */
export default function ProjectStory() {
  return (
    <section
      aria-labelledby="project-intro"
      className="flex max-w-[760px] flex-col gap-4 pb-10 pt-12 font-serif text-[19px] leading-[1.55]"
    >
      <h1 id="project-intro" className="text-[40px] leading-[1.15] font-medium">
        Another company. Another initial call.
      </h1>
      <p>
        Thirty to sixty minutes on your background, what you are looking for, and whether the
        practical details line up. A hiring manager conversation a week later. Then a technical
        round. Across the companies in your pipeline you give the same answers, tell the same
        stories, and explain the same projects, and the recruiter on the other side asks the same
        opening questions of candidate after candidate. Both sides invest those hours before
        discovering what could have been clear much earlier: the compensation does not align, the
        role is not what the posting said, or the team works in a way the candidate would not
        choose.
      </p>
      <p>
        2WayMirror moves that groundwork ahead of the meeting. A candidate prepares their experience
        once and shares a dedicated link with each company, tailored to the kind of role they are
        pursuing. The hiring team explores it when it suits them:
      </p>
      <ul className="flex list-disc flex-col gap-1.5 pl-6">
        <li>
          <strong className="font-medium">Recruiters</strong> check background, availability,
          compensation, and practical fit.
        </li>
        <li>
          <strong className="font-medium">Hiring managers</strong> read concrete examples of
          ownership, collaboration, and difficult decisions.
        </li>
        <li>
          <strong className="font-medium">Engineers</strong> examine projects, code, and technical
          tradeoffs as evidence of capability and a starting point for assessment.
        </li>
      </ul>
      <p>
        The company answers the candidate's questions in the same space. Both sides spot mismatches
        earlier, carry context into the next stage, and decide which conversations are worth
        scheduling. When you do meet, you start further along: "I read about the migration you led.
        We are facing something similar. Can we talk about the tradeoffs?"
      </p>
      <p>
        This project is my own example. Below is the story of building 2WayMirror: the
        implementation, the decisions, and the lessons. Work you can explore before deciding what
        you would like to ask me about.
      </p>
    </section>
  )
}
