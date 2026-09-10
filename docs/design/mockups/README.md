# Mockups

Source files for the design canvas referenced in the Design epic. Each `.dc.html` file is one
artboard: a self-contained static HTML page (Design Component format) that renders in any
browser; the `support.js` script line at the top is replaced by the canvas runtime and is
inert elsewhere. `canvas.json` records the artboard layout and pages. All names, companies,
dates, and answers are fictional.

| File | Board |
|---|---|
| `Screening.dc.html` | Screening tab, desktop, empty form |
| `Behavioral.dc.html` | Behavioral tab |
| `DeepDive.dc.html` | Project deep dive tab |
| `FormSent.dc.html` | Questions surface after the company's answers are sent |
| `Mobile.dc.html` | Screening tab at 390px |
| `Loading.dc.html` | Loading skeleton |
| `Expired.dc.html` | Expired or revoked link |
| `NotFound.dc.html` | Unknown link |
| `directions/` | The three direction sketches explored before the system was settled |

The tokens and rules these boards follow are in [../design-system.md](../design-system.md).
