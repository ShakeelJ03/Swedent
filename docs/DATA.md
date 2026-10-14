# Data format

All listings live in three JSON files under `data/`. The page reads them at start-up; editing them and redeploying updates the site.

## data/jobs.json

An array of positions.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `id` | string | yes | `<org>-<posting id>`, e.g. `ki-974009`. Lowercase letters, digits and hyphens only. |
| `title` | string | yes | Position title in English. |
| `org` | string | yes | University code: `KTH`, `KI`, `SU`, `SSE` (add others to `INST` in `index.html`). |
| `unit` | string | yes | Department, division or group. |
| `fields` | string[] | yes | One or more field names (see list below). |
| `kind` | string | yes | `Research assistant`, `Student assistant`, `Research engineer`, `PhD`, `Assistant`, `Thesis project` or `Other`. |
| `deadline` | string or null | yes | Last application date `YYYY-MM-DD`. `null` only with `rolling: true`. |
| `rolling` | boolean | no | `true` for rolling recruitment without a deadline. |
| `extent` | string | no | e.g. `20%, hourly` or `100%, doctoral studies`. |
| `summary` | string | yes | 1–2 sentences, taken from the official posting. |
| `requirements` | string | no | One line, from the posting. |
| `contact` | string | no | `Name, email` from the posting. |
| `url` | string | yes | Link to the official posting. |
| `verified` | string | yes | `posting` = details read from the posting; `listing` = only the title confirmed on the official board. |
| `studentFriendly` | boolean | no | `true` if current students can apply, it is hourly/part-time alongside studies, or it requires at most a bachelor's degree. |
| `labId` | string | no | `id` of the related entry in `labs.json`. |
| `checked` | string | yes | Date last verified, `YYYY-MM-DD`. |

Positions whose deadline has passed are hidden automatically by the page, and removed from the file by the daily update.

## data/labs.json

An array of research groups.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `id` | string | yes | Unique slug, e.g. `kth-kevin-smith`. |
| `name` | string | yes | Group name. |
| `pi` | string | yes | Group leader or contact as stated on the source. |
| `institution` | string | yes | University code (`KTH`, `KI`, `SU`, `SSE`, `KMH`, `Konstfack`, …). |
| `unit` | string | yes | Department or division. |
| `fields` | string[] | yes | Field names (see list below). |
| `topics` | string[] | yes | 3–6 research topics. |
| `summary` | string | yes | Only facts found on the sources. |
| `students` | string | yes | What the sources say about theses or jobs; "Not stated." if nothing. |
| `studentSignal` | string | no | `open` (takes thesis students) or `hiring` (has an open position). |
| `sources` | object[] | yes | `{type, label, url}`; type is `Group page`, `Publication`, `Grant`, `Position`, `Thesis list` or `News`. |
| `checked` | string | yes | Date last verified. |

## data/meta.json

| Field | Meaning |
|---|---|
| `updated`, `jobsChecked`, `labsChecked` | Dates shown in the footer. |
| `universities` | `{code, name, status}` list shown in the Coverage section and the Universities menu. Status `Coming soon` hides it from the menu. |
| `coverageQueue`, `coverageDone` | Departments still to add / already added to the lab map. |
| `photos` | Photo files and their credits. |

## Field names in use

AI & machine learning · Biomechanics · Biophysics & microscopy · Cardiology · Design & HCI · Ecology & environment · Economics & policy · Education · Engineering · Epidemiology & public health · Health informatics · Humanities · Law · Life science · Mathematics · Medical device software · Medical imaging · Music & arts · Neuroscience · Other · Pathology & cancer · Physics & hardware · Psychology · Robotics · Signal processing · Software & data · Women's health

Reuse these names so filters, alerts and Swedish translations keep working. A new field name needs a Swedish translation in the `SV` table in `index.html`.

## data/theses.json

Thesis projects (degree projects) in the Stockholm area. Every fact is taken from the original posting.

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | Unique, e.g. `rise-tracing-agentic-ai`. |
| `title` | string | yes | Project title. |
| `host` | string | yes | Company, institute or research group. |
| `hostType` | string | yes | `Company`, `Research institute` or `University`. |
| `unit` | string | no | Team or department. |
| `location` | string | yes | Must be in Stockholm County. |
| `fields` | string[] | yes | Same field names as jobs and labs. |
| `level` | string | yes | `Master's`, `Bachelor's` or `Master's or bachelor's`. |
| `credits` | string | no | e.g. `30 hp`. |
| `start` | string | no | As written in the posting. |
| `deadline` | string or null | yes | `YYYY-MM-DD`, or null with `rolling: true`. |
| `summary` | string | yes | 1-2 sentences. |
| `requirements` | string | no | One line. |
| `contact` | string | no | Name and email, or "Apply through the posting". |
| `url` | string | yes | Original posting. |
| `labId` | string | no | Related entry in `labs.json`. |
| `checked` | string | yes | Date last verified. |

`meta.json` also has `thesisSources` (university thesis portals shown on the Thesis page) and `thesesChecked`.
