import { GitFork } from 'lucide-react'

import { RuntimeDiagram, DeployDiagram } from '@/components/ArchitectureDiagram'
import Page from '@/components/Page'
import ProjectStory from '@/components/ProjectStory'
import Surface from '@/components/Surface'
import { FOCUS_RING, TEXT_LINK } from '@/lib/styles'
import { cn } from '@/lib/utils'

const SOURCE_URL = 'https://github.com/pkulkark/2waymirror'
const DECISIONS_URL = `${SOURCE_URL}/tree/main/docs/adr`
// Feedback about the app goes to the public repository, never to a personal address.
const FEEDBACK_URL = `${SOURCE_URL}/issues`

const decisions = [
  {
    title: 'Always deployed, sessions as data.',
    record: '0001-serverless-always-deployed-sessions-on-trigger.md',
    chosen: 'One deployment that stays up; a session is one row with a token and an expiry.',
    alternative: 'Spinning up infrastructure per recruiter when a link is needed.',
    reason:
      'A link is ready the moment the reply is written, revoking is a one-field update, and compute runs only when requested.',
  },
  {
    title: 'One DynamoDB table.',
    record: '0002-dynamodb-single-table.md',
    chosen: 'A single on-demand table designed from the four access patterns.',
    alternative: 'Postgres on RDS, or SQLite on the Lambda filesystem.',
    reason:
      'No database server, VPC, or connection pooling to manage beside Lambda. The tradeoff is that new access patterns need deliberate design.',
  },
  {
    title: 'Private content, public code.',
    record: '0007-private-content-sample-candidate.md',
    chosen: 'Real content in a private repo and bucket, served only through the token-gated API.',
    alternative: 'Bundling content into a backend deployment, or keeping the whole repo private.',
    reason:
      'The code stays demonstrable, the content stays private, and a content edit is an upload rather than a deploy.',
  },
]

function ProjectFooter() {
  return (
    <footer className="mx-auto flex w-[960px] flex-col items-center gap-2.5 py-10">
      <nav aria-label="Project links" className="flex items-center gap-6 text-[15px] font-semibold">
        <a href={SOURCE_URL} className={TEXT_LINK}>
          Source on GitHub
        </a>
        <a href={DECISIONS_URL} className={TEXT_LINK}>
          Decision records
        </a>
        <a href={FEEDBACK_URL} className={TEXT_LINK}>
          Feedback on this page
        </a>
      </nav>
      <p className="text-muted-ink text-[13px]">Built by the candidate.</p>
    </footer>
  )
}

export default function HowIBuiltIt() {
  return (
    <Page
      mainClassName="gap-0 pt-0"
      appBar={
        <header className="bg-dark sticky top-0 z-50">
          <div className="mx-auto flex h-14 w-[960px] items-center justify-between gap-6">
            <span className="text-on-dark font-serif text-[20px] leading-none font-medium">
              2WayMirror
            </span>
            <a
              href={SOURCE_URL}
              className={cn(
                'text-on-dark flex min-h-11 items-center gap-[7px] text-[15px] font-semibold hover:underline',
                FOCUS_RING,
              )}
            >
              <GitFork aria-hidden="true" strokeWidth={1.4} className="text-on-dark-muted size-4" />
              View source
            </a>
          </div>
        </header>
      }
      footer={<ProjectFooter />}
    >
      <ProjectStory />
      <div className="flex flex-col gap-6">
        <Surface title="How it works">
          <div className="flex flex-col gap-6">
            <RuntimeDiagram />
            <div className="text-muted-ink grid grid-cols-3 gap-6 text-[14px] leading-[1.5]">
              <p>
                One CloudFront distribution serves the app and routes /api/* to the API, keeping
                browser requests on the same origin.
              </p>
              <p>
                The API checks the session token before returning the appropriate content variant.
                Candidate content stays out of the JavaScript bundle.
              </p>
              <p>
                Sessions are rows with an expiry, not deployments. Creating one is a single write.
              </p>
            </div>
            <div className="border-hairline flex flex-col gap-3.5 border-t pt-6">
              <h3 className="text-muted-ink text-[13px] font-semibold">How it ships</h3>
              <DeployDiagram />
            </div>
          </div>
        </Surface>
        <Surface title="Three decisions" count="of seven">
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-3 items-stretch gap-5">
              {decisions.map((decision) => (
                <article
                  key={decision.record}
                  className="border-surface-border flex flex-col gap-3.5 rounded-[10px] border p-5"
                >
                  <h3 className="font-serif text-[20px] leading-[1.3] font-medium">
                    {decision.title}
                  </h3>
                  <dl className="flex flex-col gap-3.5 text-[14px] leading-[1.5]">
                    <div className="flex flex-col gap-1">
                      <dt className="text-moss text-[13px] font-semibold">Chosen</dt>
                      <dd>{decision.chosen}</dd>
                    </div>
                    <div className="text-muted-ink flex flex-col gap-1">
                      <dt className="text-[13px] font-semibold">Instead of</dt>
                      <dd>{decision.alternative}</dd>
                    </div>
                  </dl>
                  <p className="font-serif text-[16px] leading-[1.5]">{decision.reason}</p>
                  <a
                    className={cn(TEXT_LINK, 'mt-auto text-[14px]')}
                    href={`${SOURCE_URL}/blob/main/docs/adr/${decision.record}`}
                    aria-label={`Read decision record: ${decision.title}`}
                  >
                    Read decision record
                  </a>
                </article>
              ))}
            </div>
            <p className="text-muted-ink text-[15px] leading-[1.5]">
              The other four, and the options each one rejected, are in the repo as dated{' '}
              <a href={DECISIONS_URL} className={TEXT_LINK}>
                decision records
              </a>
              .
            </p>
          </div>
        </Surface>
        <Surface title="How AI was used">
          <p className="font-serif text-[17px] leading-[1.6]">
            I used an AI assistant throughout this project, and I want to be precise about the
            split. The idea is mine. I directed the architecture and made the final decisions,
            documenting the reasoning and alternatives in decision records. The assistant wrote the
            application code, tests, and infrastructure, and critiqued my drafts of the
            recruiter-facing answers without writing them. I reviewed the changes, challenged the
            implementation, and decided what to merge. Nothing was merged that I cannot explain in
            detail.
          </p>
        </Surface>
      </div>
    </Page>
  )
}
