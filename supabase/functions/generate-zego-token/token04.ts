import { createCipheriv } from 'node:crypto';
import { Buffer } from 'node:buffer';

export interface Token04Payload {
  room_id: string;
  privilege: Record<string, number>;
  stream_id_list?: string[] | null;
}

/**
 * ZEGOCLOUD Official Token04 Algorithm
 * Generates an AES-128-CBC encrypted, binary-packed Token04 string.
 */
export function generateToken04(
  appId: number,
  userId: string,
  secret: string,
  effectiveTimeInSeconds: number,
  payload?: string
): string {
  if (!appId || typeof appId !== 'number') {
    throw new Error('appId must be a valid number');
  }
  if (!userId || typeof userId !== 'string') {
    throw new Error('userId must be a valid string');
  }
  if (!secret || typeof secret !== 'string') {
    throw new Error('secret must be a valid string');
  }

  const createTime = Math.floor(Date.now() / 1000);
  const expire = createTime + effectiveTimeInSeconds;
  const nonce = Math.floor(Math.random() * 2147483647);

  const tokenInfo = {
    app_id: appId,
    user_id: userId,
    nonce: nonce,
    ctime: createTime,
    expire: expire,
    payload: payload || ''
  };

  const plainText = JSON.stringify(tokenInfo);

  // Generate 16-byte random IV
  const ivChars = '0123456789abcdefghijklmnopqrstuvwxyz';
  let iv = '';
  for (let i = 0; i < 16; i++) {
    iv += ivChars.charAt(Math.floor(Math.random() * ivChars.length));
  }

  // Key is the first 16 bytes of secret string
  const key = secret.length >= 16 ? secret.substring(0, 16) : secret.padEnd(16, '0');

  const cipher = createCipheriv('aes-128-cbc', Buffer.from(key, 'utf8'), Buffer.from(iv, 'utf8'));
  let encrypted = cipher.update(plainText, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);

  // Pack binary data format:
  // 1. Expire timestamp: 8 bytes (BigEndian uint64)
  const b1 = Buffer.alloc(8);
  b1.writeBigInt64BE(BigInt(expire));

  // 2. IV length: 2 bytes (BigEndian uint16)
  const b2 = Buffer.alloc(2);
  b2.writeUInt16BE(iv.length);

  // 3. IV string: 16 bytes
  const b3 = Buffer.from(iv, 'utf8');

  // 4. Encrypted length: 2 bytes (BigEndian uint16)
  const b4 = Buffer.alloc(2);
  b4.writeUInt16BE(encrypted.length);

  // 5. Encrypted binary
  const binaryBuf = Buffer.concat([b1, b2, b3, b4, encrypted]);

  return '04' + binaryBuf.toString('base64');
}
