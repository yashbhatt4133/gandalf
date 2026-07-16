import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';

function getKey() {
  const secret = process.env.API_KEY_ENCRYPTION_SECRET;
  if (!secret) throw new Error('API_KEY_ENCRYPTION_SECRET is not set.');
  // Accepts the hex-random-bytes secret from Initial Setup Guide.md, or any
  // arbitrary string — either way it's hashed down to a fixed 32-byte key.
  return crypto.createHash('sha256').update(secret).digest();
}

/** Returns `iv:authTag:ciphertext`, all hex-encoded, ready to store as text. */
export function encryptApiKey(plaintext) {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptApiKey(ciphertext) {
  const key = getKey();
  const [ivHex, authTagHex, dataHex] = ciphertext.split(':');
  if (!ivHex || !authTagHex || !dataHex) throw new Error('Malformed encrypted API key.');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
  return decrypted.toString('utf8');
}
