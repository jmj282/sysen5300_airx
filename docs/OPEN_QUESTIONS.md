# Open questions and decisions

Each question shows the default we'll build with if nobody objects. Record answers in the **Decisions**
table with a date and who decided.

| # | Question | Default if no answer |
|---|---|---|
| Q1 | Has the team received the **Posit Connect** server URL and publisher API key for the DL track? Who holds it? | Build and test locally; deploy as soon as someone shares the key through a gitignored `.env` |
| Q2 | Code review flow: feature branch + PR to `main`, or push straight to `main`? | Branch + PR |
| Q3 | Tool name: "ColdChain QC"? | ColdChain QC (team AirX) |
| Q4 | Upload page "AI agent": rule-based statistical alerts, or an LLM summary as well? | Rule-based only (no API key, reproducible, the stats are what's graded) |
| Q5 | "MTBF" (proposal) vs "MTTF" (course): show "MTTF (= MTBF for a repaired generator)"? | Yes, with a README note |
| Q6 | Storage units: all three product types (RBC, plasma, platelets) or RBC fridges only? | All three, which shows one-sided and two-sided specs |
| Q7 | Is anyone else building code right now (dashboard, data)? | No: Claude builds end to end, the team reviews |
| Q8 | Devpost demo: who records the video, and what length? | 3–4 min screen recording walking the three scenarios |
| Q9 | Ed post 8409786 (demonstration guidance): someone log in to Ed so it can be read | Follow the rubric text "a clear demonstration of the tool, using test datasets" |

## Decisions

| Date | Decision | By |
|---|---|---|
| 2026-10-20 | Build the whole tool end to end; the team iterates on it | Carter |
| 2026-10-20 | Follow Jake's scope proposal (React + Python library + FastAPI) | Carter |
| 2026-10-21 | Q2: local commits on a feature branch; review together; then merge to `main` | Carter |
| 2026-10-21 | Q3: tool name includes AirX: **AirX ColdChain QC** | Carter |
| 2026-10-21 | Q4: rule-based statistical alerts only; no LLM or API key | Carter |
| 2026-10-21 | Q6: all three product types (RBC, plasma, platelets) | Carter |
| 2026-10-21 | Q7: nobody else is coding; the team is synced | Carter |
| 2026-10-21 | Q8: the team records the demo video with OBS | Carter |
| 2026-10-21 | Q9: Ed #196 (Fraser): a video, screenshots in docs, or a guided tour through test datasets all count as the demonstration | Ed |
| 2026-10-21 | Q1 open: the team uses Posit **Cloud** (browser IDE). The Posit **Connect** publisher key for public deployment has not been confirmed for DL. Build to run locally with one command; deploy when a key or host is settled | Carter |
| 2026-10-22 | Q1 answered: course Posit Connect server and a publisher key received (key kept in a gitignored `.env` and GitHub repo secrets, never in files). Deployed `app/api/` (API + built dashboard) as one public app, no login required: see the Live URL in `README.md`. GitHub Actions redeploys on push to `main` | Owyn |
| 2026-10-23 | Q8 changed: no video; the guided tour `demo/README.md` and `docs/WALKTHROUGH.md` are the demonstration (per Q9, Ed #196) | Owyn |
