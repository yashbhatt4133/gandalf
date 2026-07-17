import { withAuth } from './_shared.js';
import { submitQuizFeedback } from '../../server/core/sessions.js';

export const handler = withAuth((user, body) => submitQuizFeedback(user.id, body));
