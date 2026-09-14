# Design system

Outcome of the Design epic (#51, #52, #53). The information architecture is in
[information-architecture.md](information-architecture.md); the mockups live on the design
canvas linked from the epic. This file is what the frontend implements.

## Direction

An app frame with surfaces on a tinted ground. A dark app bar holds identity, status, and
navigation; white surfaces with tinted, collapsible header rows hold the sections; the dark
questions surface marks where the reader's role flips from reading to answering. Serif type for
reading, sans type for the interface, one moss accent. Nothing else is decoration.

## Color

| Token | Light value | Use | shadcn variable |
|---|---|---|---|
| ground | #E3E7E1 | page background | `--background` |
| surface | #FFFFFF | app bar, tab bar, section surfaces | `--card`, `--popover` |
| surface-border | #DCE0D8 | 1px border on surfaces | `--border` |
| ink | #171512 | headings, prose | `--foreground`, `--card-foreground` |
| muted | #6E6A62 | labels, helper text, footer | `--muted-foreground` |
| hairline | #E6E3DC | rules inside a surface | (`--border` at reduced opacity) |
| accent | #2F7A4E | links, active tab, focus ring, primary button on light | `--primary`, `--ring` |
| accent-hover | #256640 | link and button hover | |
| accent-tint | #E6F1EA | session chip, evidence numbers, required chip on light | `--accent`, `--secondary` |
| dark | #14211F | app bar and the questions surface | (component token) |
| on-dark | #F2F0EA | text on the dark surface, light button fill | |
| on-dark-muted | #A9B3AE | labels and helper text on dark | |
| dark-input | #1B2A27 | textarea fill, count pills, and the questions header row on dark | |
| dark-border | #3A4A45 | textarea and outlined button border on dark | |
| danger | #B23A3A (#E8A29A on dark) | validation text | `--destructive` |
| skeleton | #E3E6E0 (#2A3936 on dark) | loading placeholders | |

The dark bar and the dark surface are components, not a theme: it keeps its values in both light and dark mode.
A dark mode for the rest of the page is out of scope for v1; the tokens above are the light
theme, expressed in `frontend/src/index.css` as oklch conversions of these values.

## Type

Two families, loaded from Google Fonts with `display=swap`:

- Newsreader (400, 500, italic 400), fallback Georgia. The name in the app bar, section and
  surface titles,
  question headings, summaries (italic), prose, logistics values, dead-end titles and messages.
- Source Sans 3 (400, 600), fallback system-ui. Tabs, chips, labels, buttons, form fields,
  helper text, footer, the links row, the status line.

| Role | Face | Size / line height | Weight |
|---|---|---|---|
| App bar name | Newsreader | 20px / 1 | 500 |
| Surface title (header row) | Newsreader | 22px / 1.2 | 500 |
| Question heading | Newsreader | 20px / 1.3 | 500 |
| Summary (lead) | Newsreader italic | 18px / 1.45 | 400 |
| Prose, logistics value | Newsreader | 17px / 1.6 | 400 |
| Tabs, buttons, field text | Source Sans 3 | 15px / 1.4 | 600 (400 in fields) |
| Label, chip, status, footer | Source Sans 3 | 13px / 1.4 | 600 (400 footer) |
| Headline in the app bar | Source Sans 3 | 15px / 1.4 | 400, on-dark-muted |
| Count pill, chip | Source Sans 3 | 12px to 13px / 1.4 | 600 |

Sentence case everywhere. No all-caps, no tracking on labels, no em-dashes in copy.

## Layout

- Content width 960px, centered. Content inside a surface spans the full inner width.
- App bar: one dark block, no border, four rows at the content width. Row 1 (56px): the name
  left; on the right a status chip ("0 of 2 required answered", or "Sent 10 September":
  outlined in dark-border, on-dark-muted text) and the session chip ("Acme Corp, until 15
  Sep": accent-tint fill, accent text), both 13px 600 with a 999px radius. Row 2: the
  headline. Row 3: the profile links (Email, GitHub, LinkedIn) with 16px stroke icons in
  on-dark-muted and labels in on-dark. Row 4 (44px): the tabs, 15px 600 on-dark-muted, the
  active tab in on-dark with a 2px accent underline flush with the block's bottom edge, each
  label followed by a count pill (dark-input fill, on-dark-muted text). The bar is fixed; the
  tabs row stays visible while the content scrolls.
- No "prepared for" text: the session chip carries the company and the expiry.
- Surfaces: 12px radius, 1px surface-border, no shadow, 24px apart. Each starts with a 52px
  header row filling accent-tint with the top radius: an 18px stroke icon in accent, the title,
  and on the right a count ("4 items", "2 answers") and a chevron. The header toggles the
  surface; everything is expanded by default. Icons: map pin for logistics, speech bubbles for
  the initial conversation, a person outline for behavioral, code brackets for the deep dive.
  Body padding 28px 36px 36px.
- Logistics rows: label above value, 14px vertical padding, hairline between rows.
- Answers: a header row with the question left and, on the right, an evidence count and a
  chevron (the row toggles the answer; expanded by default); then the summary, paragraphs 16px
  apart, and the evidence list. Hairline and 28px between answers.
- Evidence: a 22px accent-tint circle with the number in accent, the link label in accent,
  the type word in muted after it. The marker in the prose is a superscript number in accent.
- Questions surface: dark fill, same width and radius, no border, no icon. Its header row is
  dark-input with the title in on-dark and the status ("0 of 2 required answered", or "Sent 10
  September") plus a chevron in on-dark-muted. Fields 96px tall, 8px radius. Primary button on
  dark is on-dark fill with dark text; secondary is outlined.
- Sent state: a check icon and "Answers sent on <date>. I will reply by email within two
  working days." with an "Edit answers" secondary button, then each question with its answer as
  prose or "Not answered yet" in italic muted. The bar's status chip reads "Sent <date>".
- Dead ends: the bar shows only the name (expired) or the wordmark (not found), no chips, no
  tabs; one centered 560px surface with the title, the message, and for expired an email
  button in accent.
- Footer: 13px, centered: a link "How this page was made".
- Controls: 44px minimum hit height; 2px accent focus ring with 2px offset.
- Mobile (under 640px): the bar stacks (name, chips row with the session chip shortened to
  "until 15 Sep", headline, links, tabs scrolling horizontally) with 16px side padding;
  surfaces get 16px side margins and 20px side padding; buttons go full width.

## Motion

- Tab change: content crossfades in 150ms ease-out; the underline slides in 200ms.
- Collapse and expand: height animates over 200ms ease-out; the chevron rotates with it.
- Send: the button reads "Sending" with a spinner, then the sent state fades in over 200ms.
- Loading skeleton: a 1.6s opacity pulse.
- Everything above is disabled under `prefers-reduced-motion`.

## Component inventory (shadcn/ui)

Button (primary on light, primary on dark, secondary on dark), Badge (session chip, required
chip), Tabs (restyled to the underline form), Collapsible (surfaces and answers), Textarea, Skeleton,
Alert (validation only), plus project components: AppBar, Surface (with its header row),
LogisticsList, Answer, EvidenceList, QuestionsSurface, DeadEnd.

## Do not

Grey drop shadows, gradients, all-caps labels, middle-dot separators, arrows on link text,
left-border accent stripes, emoji as icons, an eyebrow label above every heading.
