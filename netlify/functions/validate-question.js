import { withAuth } from './_shared.js';
import { validateQuestion } from '../../server/core/sessions.js';

export const handler = withAuth((user, body) => validateQuestion(user.id, body));
