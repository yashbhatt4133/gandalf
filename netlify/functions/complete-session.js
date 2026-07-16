import { withAuth } from './_shared.js';
import { finishSession } from '../../server/core/sessions.js';

export const handler = withAuth((user, body) => finishSession(user.id, body));
