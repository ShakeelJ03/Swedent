# Swedent

Research jobs, PhD positions and research groups for students at Stockholm's universities, in one place.

Swedent collects open positions from the official job boards of KTH, Karolinska Institutet, Stockholm University and the Stockholm School of Economics, and profiles of research groups built from their public pages. Every listing links to its official source.

## Features

| Feature | What it does |
|---|---|
| Jobs | Search and filter open positions by field, role type and university. Each job has its own page with key facts and a link to the official posting. |
| Labs | Research group profiles with research areas, student opportunities and sources. |
| Lab directory | A compact list of every group and its main research, grouped by university. |
| Job alerts | Save a search; new matching positions are highlighted on the next visit. |
| Recommendations | Suggestions based on what you save and open, computed on your device. |
| CV Match | Upload a CV and see ranked labs and jobs with reasons and sources. Requires Claude (see below). |
| Outreach email | Drafts a short first email to a research group. Requires Claude. |
| Swedish | Full interface in English (default) or Swedish. |
| Privacy | Profile, saved items and alerts are stored only on the user's device. Cookie consent with "Reject all". |

## Project structure

```
index.html            The whole site: markup, styles and script in one file
data/jobs.json        Open positions (see docs/DATA.md)
data/labs.json        Research group profiles (see docs/DATA.md)
data/theses.json      Thesis projects (see docs/DATA.md)
data/meta.json        Update dates, university coverage, photo credits
img/                  Logo and photos
tests/                Headless test harness (100+ simulated users)
docs/                 Data format, updating and deployment guides
.github/workflows/    Automatic deployment to GitHub Pages
```

The site is static: no build step, no server and no dependencies. The page loads `data/*.json` at start-up.

## Run locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Opening `index.html` directly from disk will not load the data files, because browsers block `fetch` on `file://`. Use the local server above.

## Tests

The test harness runs the real page script in a small emulated browser and drives every flow (menus, search, filters, job and lab pages, alerts, profile, CV Match with simulated AI answers including broken ones, Swedish mode, cookie consent, reload persistence).

```bash
node tests/run.js 120     # 120 simulated students from 25 fields
```

Requires Node.js 18 or newer. It prints pass rates per flow, timing, uncaught errors, untranslated Swedish text and data coverage per field. See `tests/README.md`.

## Deployment

Pushing to `main` deploys the site to GitHub Pages automatically. To use your own domain, see `docs/DEPLOY.md`.

## AI features on your own domain

CV Match, the search assistant and email drafting call Claude. On a plain static host they show a "coming soon" notice instead; everything else works. Enabling them on your own domain needs a small server-side function that holds your Anthropic API key (never put the key in `index.html`). See `docs/DEPLOY.md`.

## Data and sources

Listings are verified against the official job boards before they are added, and removed once the deadline has passed. Lab profiles only contain facts found on official university pages, publications, grants or postings, and each links to its source. See `docs/UPDATING.md`.

Swedent is an independent platform and is not affiliated with or endorsed by any university. University names are used only to identify where a position or group is based.

## Credits

- Library photos: Pexels (Pexels License)
- Fonts: Schibsted Grotesk and IBM Plex Mono (Google Fonts, SIL Open Font License)
- PDF text extraction: pdf.js (Apache 2.0), loaded from cdnjs only when a user uploads a PDF

© 2026 Swedent. All rights reserved.
