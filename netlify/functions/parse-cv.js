import { withAuth } from './_shared.js';
import { parseCvForUser } from '../../server/core/sessions.js';

export const handler = withAuth((user, body) => parseCvForUser(user.id, body.text));
