import { withAuth } from './_shared.js';
import { suggestTopicsForUser } from '../../server/core/sessions.js';

export const handler = withAuth((user, body) => suggestTopicsForUser(user.id, body));
