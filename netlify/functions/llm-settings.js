import { withAuth } from './_shared.js';
import { getLlmSettingsForUser, saveLlmSettingsForUser } from '../../server/core/sessions.js';

export const handler = withAuth(async (user, body, event) => {
  if (event.httpMethod === 'POST') {
    return saveLlmSettingsForUser(user.id, body);
  }
  return getLlmSettingsForUser(user.id);
});
