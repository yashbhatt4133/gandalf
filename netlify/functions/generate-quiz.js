import { withAuth } from './_shared.js';
import { createQuizSession } from '../../server/core/sessions.js';

export const handler = withAuth((user, body) => createQuizSession(user.id, body));
