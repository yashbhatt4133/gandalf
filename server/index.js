import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';

// Load server/.env explicitly — `dotenv/config` alone resolves relative to
// process.cwd(), which is the repo root when run via `npm run server`, not
// this file's directory.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

import { verifyUser } from './core/supabaseAdmin.js';
import { statusForError } from './core/errors.js';
import {
  getLlmSettingsForUser,
  saveLlmSettingsForUser,
  parseCvForUser,
  createQuizSession,
  generateNextAdaptiveQuestion,
  submitAnswer,
  finishSession,
  submitQuizFeedback,
  explainQuestion,
  validateQuestion,
  generateVerticalsForJourney,
} from './core/sessions.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

function asyncHandler(fn) {
  return (req, res) =>
    fn(req, res).catch((err) => {
      console.error(err);
      res.status(statusForError(err)).json({ error: err.message || 'Internal server error' });
    });
}

app.get('/health', (_req, res) => res.json({ ok: true }));

app.get(
  '/api/llm-settings',
  asyncHandler(async (req, res) => {
    const user = await verifyUser(req.headers.authorization);
    res.json(await getLlmSettingsForUser(user.id));
  })
);

app.post(
  '/api/llm-settings',
  asyncHandler(async (req, res) => {
    const user = await verifyUser(req.headers.authorization);
    res.json(await saveLlmSettingsForUser(user.id, req.body));
  })
);

app.post(
  '/api/parse-cv',
  asyncHandler(async (req, res) => {
    const user = await verifyUser(req.headers.authorization);
    res.json(await parseCvForUser(user.id, req.body.text));
  })
);

app.post(
  '/api/generate-quiz',
  asyncHandler(async (req, res) => {
    const user = await verifyUser(req.headers.authorization);
    res.json(await createQuizSession(user.id, req.body));
  })
);

app.post(
  '/api/generate-adaptive-question',
  asyncHandler(async (req, res) => {
    const user = await verifyUser(req.headers.authorization);
    res.json(await generateNextAdaptiveQuestion(user.id, req.body));
  })
);

app.post(
  '/api/answer-question',
  asyncHandler(async (req, res) => {
    const user = await verifyUser(req.headers.authorization);
    res.json(await submitAnswer(user.id, req.body));
  })
);

app.post(
  '/api/complete-session',
  asyncHandler(async (req, res) => {
    const user = await verifyUser(req.headers.authorization);
    res.json(await finishSession(user.id, req.body));
  })
);

app.post(
  '/api/quiz-feedback',
  asyncHandler(async (req, res) => {
    const user = await verifyUser(req.headers.authorization);
    res.json(await submitQuizFeedback(user.id, req.body));
  })
);

app.post(
  '/api/explain-question',
  asyncHandler(async (req, res) => {
    const user = await verifyUser(req.headers.authorization);
    res.json(await explainQuestion(user.id, req.body));
  })
);

app.post(
  '/api/validate-question',
  asyncHandler(async (req, res) => {
    const user = await verifyUser(req.headers.authorization);
    res.json(await validateQuestion(user.id, req.body));
  })
);

app.post(
  '/api/generate-learning-verticals',
  asyncHandler(async (req, res) => {
    const user = await verifyUser(req.headers.authorization);
    res.json(await generateVerticalsForJourney(user.id, req.body));
  })
);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Gandalf server listening on http://localhost:${PORT}`);
});
