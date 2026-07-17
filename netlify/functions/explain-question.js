import { withAuth } from './_shared.js';
import { explainQuestion } from '../../server/core/sessions.js';

export const handler = withAuth((user, body) => explainQuestion(user.id, body));
