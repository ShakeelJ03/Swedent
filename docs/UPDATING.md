# Keeping listings up to date

## Rules for every entry

1. Only add a position after reading the official posting. Take title, unit, deadline, extent, summary, requirements and contact from the posting itself.
2. If only the official board's list can be read, add it with `"verified": "listing"` and the summary "Listed on the official job board. Open the posting for the full description."
3. Never guess or invent a field. Leave it out instead.
4. Translate Swedish postings to English, keeping facts exact.
5. Lab profiles only state what their sources say, and every profile has at least one official source.

## Daily job update

Official boards checked:

| University | Board |
|---|---|
| KTH | https://www.kth.se/lediga-jobb?l=en |
| Karolinska Institutet | https://ki.varbi.com/en/ |
| Stockholm University | https://su.varbi.com/en/ |
| Stockholm School of Economics | https://jobs.hhs.se/en/job-vacancies |

Included: research assistant, student assistant / amanuens, hourly or part-time roles, research engineer, PhD positions and thesis projects, in any field. Excluded: postdoc, lecturer, professor, tenure-track, administrative, HR and IT-operations roles.

Each day:

1. Remove positions whose deadline has passed.
2. Add new verified positions to `data/jobs.json`.
3. Set `jobsChecked` and `updated` in `data/meta.json`.
4. Validate the JSON (`python3 -m json.tool data/jobs.json > /dev/null`).
5. Commit and push. The site redeploys automatically.

## Weekly lab update

Take the next departments from `coverageQueue` in `data/meta.json`, add verified lab profiles, move the department to `coverageDone`, re-check the oldest profiles' sources, and push.

## Universities still to add

Södertörn University, GIH, Konstfack (jobs), Royal College of Music (jobs), Stockholm University of the Arts, Sophiahemmet University, Swedish Red Cross University, Swedish Defence University, Ersta Sköndal Bräcke University College. Add each board to the table above, add its code to `INST` in `index.html`, and set its status in `meta.json`.
