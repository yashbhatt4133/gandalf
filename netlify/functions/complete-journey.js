import { withAuth } from './_shared.js';
import { forceCompleteJourney } from '../../server/core/sessions.js';

export const handler = withAuth((user, body) => forceCompleteJourney(user.id, body));
