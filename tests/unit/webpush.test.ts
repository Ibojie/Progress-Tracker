// @vitest-environment node
//
// The Web Push sender is checked against an independent implementation: Node's crypto module
// decrypts each message exactly as a browser would (RFC 8291 / RFC 8188), and verifies the
// VAPID signature. If these pass, a phone can read what the server sends.
import { createDecipheriv, createECDH, createHmac, createPublicKey, verify } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { b64urlDecode, b64urlEncode, encryptPayload, vapidAuthorization } from '../../supabase/functions/notify/webpush';

const hmac = (key: Buffer, data: Buffer) => createHmac('sha256', key).update(data).digest();
const hkdf = (salt: Buffer, ikm: Buffer, info: Buffer, len: number) => hmac(hmac(salt, ikm), Buffer.concat([info, Buffer.from([1])])).subarray(0, len);

/** What the browser does with an incoming push (receiver side). */
function browserDecrypt(message: Uint8Array, receiver: ReturnType<typeof createECDH>, auth: Buffer): string {
  const buf = Buffer.from(message);
  const salt = buf.subarray(0, 16);
  const rs = buf.readUInt32BE(16);
  const idLen = buf[20]!;
  const senderPublic = buf.subarray(21, 21 + idLen);
  const cipher = buf.subarray(21 + idLen);
  expect(rs).toBe(4096);

  const shared = receiver.computeSecret(senderPublic);
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), receiver.getPublicKey(), senderPublic]);
  const ikm = hkdf(auth, shared, keyInfo, 32);
  const cek = hkdf(salt, ikm, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = hkdf(salt, ikm, Buffer.from('Content-Encoding: nonce\0'), 12);

  const decipher = createDecipheriv('aes-128-gcm', cek, nonce);
  decipher.setAuthTag(cipher.subarray(cipher.length - 16));
  const plain = Buffer.concat([decipher.update(cipher.subarray(0, cipher.length - 16)), decipher.final()]);
  expect(plain[plain.length - 1]).toBe(2); // last-record delimiter
  return plain.subarray(0, plain.length - 1).toString('utf8');
}

describe('Web Push encryption', () => {
  it('a browser can decrypt what the server sends', async () => {
    const receiver = createECDH('prime256v1');
    receiver.generateKeys();
    const auth = Buffer.from(crypto.getRandomValues(new Uint8Array(16)));
    const payload = JSON.stringify({ title: 'Due today: Mock exam', body: 'PMI 2027 · tick it off', url: '/elements/1', tag: 'x' });

    const message = await encryptPayload(new TextEncoder().encode(payload), new Uint8Array(receiver.getPublicKey()), new Uint8Array(auth));
    expect(browserDecrypt(message, receiver, auth)).toBe(payload);
  });

  it('a wrong auth secret cannot decrypt it', async () => {
    const receiver = createECDH('prime256v1');
    receiver.generateKeys();
    const message = await encryptPayload(new TextEncoder().encode('hi'), new Uint8Array(receiver.getPublicKey()), new Uint8Array(16).fill(1));
    expect(() => browserDecrypt(message, receiver, Buffer.alloc(16, 2))).toThrow();
  });
});

describe('VAPID', () => {
  it('signs a JWT the push service can verify with our public key', async () => {
    const keys = createECDH('prime256v1');
    keys.generateKeys();
    const vapid = { publicKey: b64urlEncode(keys.getPublicKey()), privateKey: b64urlEncode(keys.getPrivateKey()), subject: 'mailto:owner@example.com' };
    const now = Date.UTC(2026, 9, 28, 7, 0, 0);

    const header = await vapidAuthorization('https://fcm.googleapis.com/fcm/send/abc', vapid, now);
    const [, jwt, k] = /^vapid t=([^,]+), k=(.+)$/.exec(header)!;
    expect(k).toBe(vapid.publicKey);

    const [h, c, s] = jwt!.split('.');
    expect(JSON.parse(Buffer.from(b64urlDecode(h!)).toString())).toEqual({ typ: 'JWT', alg: 'ES256' });
    expect(JSON.parse(Buffer.from(b64urlDecode(c!)).toString())).toEqual({
      aud: 'https://fcm.googleapis.com',
      exp: now / 1000 + 12 * 3600,
      sub: 'mailto:owner@example.com',
    });

    const pub = keys.getPublicKey();
    const key = createPublicKey({
      key: { kty: 'EC', crv: 'P-256', x: b64urlEncode(pub.subarray(1, 33)), y: b64urlEncode(pub.subarray(33)) },
      format: 'jwk',
    });
    const ok = verify('sha256', Buffer.from(`${h}.${c}`), { key, dsaEncoding: 'ieee-p1363' }, Buffer.from(b64urlDecode(s!)));
    expect(ok).toBe(true);
  });

  it('base64url round-trips', () => {
    const bytes = new Uint8Array([0, 255, 62, 63, 250, 1]);
    expect(b64urlDecode(b64urlEncode(bytes))).toEqual(bytes);
    expect(b64urlEncode(bytes)).not.toMatch(/[+/=]/);
  });
});
