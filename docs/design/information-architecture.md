# Information architecture

Outcome of the Design epic's first step (#50). This is the page structure the mockups (#51, #52,
#54) and the frontend are built against. Names, companies, and dates in the examples are fictional.

## Audiences and reading order

The link is sent to a recruiter, who reads first and answers most of the company questions. The
recruiter may then pass the same link to a hiring manager, who reads the deeper material. The
page is therefore ordered for the recruiter, with the deeper sections one click away rather than
in the scroll path.

## Routes

| Route | Page |
|---|---|
| `/` | How it was built. Opens with what 2WayMirror is, then the build story. There is no separate landing page. |
| `/s/:token` | Session, screening tab (default). |
| `/s/:token/behavioral` | Session, behavioral tab. |
| `/s/:token/deep-dive` | Session, project deep dive tab. |

Each tab has its own URL so a recruiter can forward a link straight to a tab. Tab routes are
derived from the section ids in the content, in section order; the first section is the screening
tab together with logistics and the company questions.

## Session page

### App bar, on every tab

A dark bar, fixed to the top, holding in order: the candidate's name with a status chip
("0 of 2 required answered", or "Sent 10 September" once answers are in) and a session chip
("Acme Corp, until 15 Sep") on the right; the headline; the profile links (email, GitHub,
LinkedIn); and the tab bar with a count on each tab: Screening, Behavioral, Project deep dive.
The session chip is the only place the company and the expiry appear. No role-level badge, no
contact name, no separate profile strip.

### Sections

Every section is a surface with a header row (icon, title, count, chevron) that collapses it.
Everything is expanded by default. Each answer inside a section has its own header row
(question, evidence count, chevron) and collapses the same way.

### Screening tab

1. Logistics. Stacked definition list, one item per row, label above value, no card, a single
   rule below it.
2. Initial conversation. Every answer in full: question, one-line summary as the lead, then the
   prose. Nothing collapsed, no read-more.
3. Questions for you. The company question form, last, with no pointer to it from the header. It
   follows the shape of a real first call: the candidate's side, then the company's.

### Behavioral and deep dive tabs

Each is one section of full answers, same answer layout as the screening tab. The deep dive tab
opens with its single answer in full.

### Answer layout

Question as the heading, summary as a lead line, prose, then the evidence list. Evidence is tied
to the prose footnote style: a small numbered marker in the prose where an item is mentioned, and
the evidence list numbered in the same order, each entry showing its type (repo, PR, talk,
writeup). The marker syntax in Markdown is a content convention settled in the Frontend epic.

### Company questions and the submit model

Answers are editable until the link expires. Sending stores them and the block then shows the
answers read-only under a confirmation ("Answers sent on 10 September. I will reply by email
within two working days.") with an "Edit answers" action; sending again replaces the previous
answers. A later visitor on the same link sees the same read-only block, so a hiring manager knows
the recruiter already answered. Unsent text is kept in the browser so a closed tab does not lose
it. Backend change: `GET /api/sessions/{token}` returns the stored answers, and a second submit
replaces instead of returning 409.

### Footer, on every tab

One line: "Built by the candidate. How this page was made", linking to `/`. No hand-off block
after the form; the tab bar is the pointer to the deeper sections.

## Dead ends

Expired and revoked read the same to the visitor: what happened in plain words, the date the link
stopped working, and the candidate's name and email to ask for a new one. Backend change: the 410
response carries the candidate's name, contact email, and the expiry date. Not found stays as it
is: the link does not match a session, check the URL or ask for a new one. Loading is a skeleton
of the app bar and the first screen of the screening tab.

## Mobile

The app bar stacks (name, chips, headline, links, tabs). The tab bar scrolls horizontally if it
does not fit. Logistics is already single column. Everything else is one reading column.
