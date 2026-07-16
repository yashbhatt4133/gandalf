import { withAuth } from './_shared.js';
import { submitAnswer } from '../../server/core/sessions.js';

export const handler = withAuth((user, body) => submitAnswer(user.id, body));
