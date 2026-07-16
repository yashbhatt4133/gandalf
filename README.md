# Gandalf

An adaptive practice platform for technical placement/interview
assessments — logical & quantitative reasoning, CS fundamentals (DSA,
OOP, DBMS, OS, Networks), and role-specific tracks for Software Engineer,
AI Engineer, ML Engineer, and Data Scientist candidates.

Bring your own LLM: run entirely offline against a local model
(Ollama), or plug in Groq, OpenAI, or Gemini — switch anytime from
Settings.

## What it does

- **Adaptive calibration quiz** — take a short quiz on any topic, get
  scored, and land on a personalized practice journey for it.
- **Curated learning content** — ranked, tiered topic breakdowns
  (definition, worked example, personal-interest analogy, real scenario,
  sources) generated for you, not just a flat link dump.
- **Reassessment loop** — come back after studying, retest, and the score
  decides whether you're done, need to read more, or need to start over.
- **Time-Bound Tests** — simulate a real OA/OT: pick a topic, question
  count, and time limit, and race the clock.
- **"Predict the output" questions** — a code snippet, multiple-choice
  answers for what it does — alongside standard conceptual MCQs.
- **Per-journey metrics** — accuracy trend, time-per-question, and
  topic-mastery breakdown, not just a single score.
- Every practice session and profile detail is yours — editable anytime,
  not a one-time setup wizard.

## Try it

- **Live demo**: *(add your Netlify URL here once deployed)* — sign up
  with any email/password, no invite needed. Runs on a shared, rate-limited
  API key so everyone can try it; add your own free API key in Settings
  for unlimited use.
- **Run it yourself** (recommended if you want to actually use it for
  practice — faster, free, works offline): see "Run locally" below.

## Architecture

```
   React + Vite + TypeScript (Tailwind, "White Wizard" theme)
                |
     Supabase (Postgres + Auth + Realtime, RLS on)
                |
   ------------------------------------------------
   |                                              |
Express server (local dev)              Netlify Functions (deployed)
   |                                              |
   ------------------- shared -----------------------
                server/core/  (provider abstraction, quiz
                generation, content generation — one
                implementation, two thin adapters)
                        |
        --------------------------------------------
        |          |            |                  |
      Ollama      Groq        OpenAI             Gemini
     (local only)                 (cloud, pick any/all)
```

No retrieval/RAG step, no second "orchestrator" model — every feature is
one call to whichever provider is currently selected. Full design
rationale in `context/PROVIDERS.md` and `CLAUDE.md`.

## Tech stack

- **Frontend**: React, Vite, TypeScript, Tailwind CSS
- **Backend/DB**: Supabase (Postgres, Auth, Realtime, Row Level Security)
- **Local server**: Node/Express
- **Deployed server**: Netlify Functions
- **LLM providers**: Ollama (local), Groq, OpenAI, Gemini — user-selectable

## Run locally

Full step-by-step in `context/Initial Setup Guide.md`. Short version:

1. Create a free Supabase project, run the schema SQL from
   `context/ERD.md`, enable email/password auth (email confirmation
   off).
2. Copy `.env.example` → `.env` (root) and `server/.env.example` →
   `server/.env`, fill in your Supabase project's URL/keys.
3. Either install [Ollama](https://ollama.com) and `ollama pull llama3.1`,
   or grab a free API key from [Groq](https://console.groq.com/keys) (or
   OpenAI/Gemini) and put it in `server/.env`.
4. ```
   npm install
   npm run dev          # frontend, http://localhost:5173
   npm run server        # bridge server, http://localhost:4000
   ```
5. Sign up with any email/password and start practicing.

## Deploying your own copy

See `context/DEPLOYMENT.md` for the full Netlify setup (frontend +
Functions in one site) and `context/Initial Setup Guide.md` §6 for the
exact environment variables to set.

## Project structure

```
src/            React frontend (screens, components, lib)
server/         Express adapter (local) + server/core (shared LLM/quiz/content logic)
netlify/        Netlify Functions adapter (deployed)
context/        Design docs this project was built from (ERD, providers, taxonomy, deployment, build plan, timeline)
```

## License / status

Personal project, built for practice and to demonstrate a working
full-stack + multi-LLM-provider application. Not affiliated with any
employer past or present.
