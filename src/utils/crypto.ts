import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export interface EncryptedSecret {
  encryptedValue: string;
  iv: string;
  authTag: string;
}

const algorithm = 'aes-256-gcm';

export function encryptSecret(value: string, masterKey: Buffer): EncryptedSecret {
  const iv = randomBytes(12);
  const cipher = createCipheriv(algorithm, masterKey, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encryptedValue: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64')
  };
}

export function decryptSecret(
  encryptedValue: string,
  ivBase64: string,
  authTagBase64: string,
  masterKey: Buffer
): string {
  const iv = Buffer.from(ivBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');
  const encrypted = Buffer.from(encryptedValue, 'base64');

  const decipher = createDecipheriv(algorithm, masterKey, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}
