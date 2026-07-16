import { AuthError } from './supabaseAdmin.js';
import { UsageLimitError, ProviderConfigError } from './providers/index.js';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export class NotFoundError extends HttpError {
  constructor(message = 'Not found.') {
    super(404, message);
  }
}
export class BadRequestError extends HttpError {
  constructor(message = 'Bad request.') {
    super(400, message);
  }
}

/** Maps any error thrown by a core handler to an HTTP status — shared by both adapters. */
export function statusForError(err) {
  if (err instanceof AuthError) return 401;
  if (err instanceof UsageLimitError) return 429;
  if (err instanceof ProviderConfigError) return 400;
  if (err instanceof HttpError) return err.status;
  return 500;
}

export { AuthError, UsageLimitError, ProviderConfigError };
