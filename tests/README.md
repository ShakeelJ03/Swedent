# Tests

`run.js` loads `index.html` into a small emulated browser (`dom.js`) and runs the real page script. For each simulated student (`personas.js`, 25 fields, including short, Swedish and very long CVs) it:

1. Loads the site and checks listings and counters render.
2. Accepts, rejects or opens cookie settings.
3. Opens every dropdown menu and follows a random item.
4. Searches from the hero search bar and checks result counts.
5. Combines random job filters and checks counts match the cards shown.
6. Opens a job page, saves it, copies details, opens a similar job, checks Saved jobs.
7. Searches labs, saves one and opens its page; checks source links.
8. Drafts an outreach email.
9. Filters the lab directory and opens a lab.
10. Creates a job alert.
11. Fills in the profile, including an invalid LinkedIn link.
12. Runs CV Match.
13. Uses the search assistant and follows a link in the answer.
14. Switches to Swedish, scans every page for untranslated interface text, and switches back.
15. Checks recommendations appear.
16. Reloads and checks the profile is kept (or not kept, after "Reject all").
17. Deletes all data.

Claude is simulated. A third of the runs return deliberately broken answers (unknown IDs, malformed JSON, rate limits, refusals, outages) to check the site handles them. The results therefore measure the site's robustness, not the quality of Claude's real matches.

```bash
node tests/run.js 120
```

Output: pass rate and timing per flow, uncaught errors, text problems (`undefined`, `NaN`), untranslated Swedish text, simulated match relevance per field, and data coverage per field. Full results are written to `tests/results.json` (ignored by git).
