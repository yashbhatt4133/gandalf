import { withAuth } from './_shared.js';
import { generateNextAdaptiveQuestion } from '../../server/core/sessions.js';

export const handler = withAuth((user, body) => generateNextAdaptiveQuestion(user.id, body));
