import { verifyUser } from '../../server/core/supabaseAdmin.js';
import { statusForError } from '../../server/core/errors.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

/**
 * Wraps a Netlify Function handler with JWT verification + JSON body
 * parsing + uniform error mapping — the Netlify-side equivalent of
 * server/index.js's `asyncHandler`, so both adapters stay thin and share
 * every bit of actual logic via server/core/* (see DEPLOYMENT.md).
 */
export function withAuth(handlerFn) {
  return async (event) => {
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 204, headers: CORS_HEADERS, body: '' };
    }
    try {
      const authHeader = event.headers.authorization || event.headers.Authorization;
      const user = await verifyUser(authHeader);
      const body = event.body ? JSON.parse(event.body) : {};
      const result = await handlerFn(user, body, event);
      return { statusCode: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }, body: JSON.stringify(result) };
    } catch (err) {
      console.error(err);
      return {
        statusCode: statusForError(err),
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: err.message || 'Internal server error' }),
      };
    }
  };
}
