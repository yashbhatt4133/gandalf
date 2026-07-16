import { withAuth } from './_shared.js';
import { generateVerticalsForJourney } from '../../server/core/sessions.js';

export const handler = withAuth((user, body) => generateVerticalsForJourney(user.id, body));
