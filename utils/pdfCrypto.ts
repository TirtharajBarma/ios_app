/**
 * Pure TypeScript, self-contained Cryptographic Engine for PDF Standard Security Handlers (R2 to R6).
 * Zero external dependencies — 100% on-device local execution compatible with Hermes, JSC, and Node.
 */

// ── Standard PDF 32-byte Password Padding ─────────────────────────────────────
export const PDF_PASSWORD_PADDING = new Uint8Array([
  0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41,
  0x64, 0x00, 0x4e, 0x56, 0xff, 0xfa, 0x01, 0x08,
  0x2e, 0x2e, 0x00, 0xb6, 0xd0, 0x68, 0x3e, 0x80,
  0x2f, 0x0c, 0xa9, 0xfe, 0x64, 0x53, 0x69, 0x7a,
]);

export interface PdfEncryptionInfo {
  filter: string;
  v: number; // 1, 2, 4, 5
  r: number; // 2, 3, 4, 5, 6
  length: number; // in bits (e.g. 40, 128, 256)
  p: number; // permissions flags
  o: Uint8Array; // 32 or 48 bytes
  u: Uint8Array; // 32 or 48 bytes
  oe?: Uint8Array; // 32 bytes for R5/R6
  ue?: Uint8Array; // 32 bytes for R5/R6
  perms?: Uint8Array; // 16 bytes for R5/R6
  idFirst: Uint8Array; // First string in /ID array (16 bytes)
  encryptMetadata: boolean;
  isAes: boolean;
}

// ── 1. Pure TypeScript MD5 Implementation ──────────────────────────────────────
const MD5_K = new Uint32Array([
  0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
  0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
  0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
  0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
  0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c, 0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
  0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
  0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
  0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1, 0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391,
]);

const MD5_S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];

export function md5(data: Uint8Array): Uint8Array {
  const len = data.length;
  const bitLen = len * 8;
  const padLen = (((55 - (len % 64)) + 64) % 64) + 1;
  const totalLen = len + padLen + 8;
  const buf = new Uint8Array(totalLen);
  buf.set(data);
  buf[len] = 0x80;

  // Append bit length in little-endian 64-bit
  buf[totalLen - 8] = bitLen & 0xff;
  buf[totalLen - 7] = (bitLen >>> 8) & 0xff;
  buf[totalLen - 6] = (bitLen >>> 16) & 0xff;
  buf[totalLen - 5] = (bitLen >>> 24) & 0xff;

  let a = 0x67452301;
  let b = 0xefcdab89;
  let c = 0x98badcfe;
  let d = 0x10325476;

  const words = new Uint32Array(16);

  for (let offset = 0; offset < totalLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      const idx = offset + i * 4;
      words[i] = buf[idx] | (buf[idx + 1] << 8) | (buf[idx + 2] << 16) | (buf[idx + 3] << 24);
    }

    let aa = a;
    let bb = b;
    let cc = c;
    let dd = d;

    for (let i = 0; i < 64; i++) {
      let f = 0;
      let g = 0;

      if (i < 16) {
        f = (b & c) | (~b & d);
        g = i;
      } else if (i < 32) {
        f = (d & b) | (~d & c);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        f = b ^ c ^ d;
        g = (3 * i + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        g = (7 * i) % 16;
      }

      const temp = d;
      d = c;
      c = b;
      const sum = (a + f + MD5_K[i] + words[g]) | 0;
      const rot = MD5_S[i];
      b = (b + ((sum << rot) | (sum >>> (32 - rot)))) | 0;
      a = temp;
    }

    a = (a + aa) | 0;
    b = (b + bb) | 0;
    c = (c + cc) | 0;
    d = (d + dd) | 0;
  }

  const out = new Uint8Array(16);
  const outWords = [a, b, c, d];
  for (let i = 0; i < 4; i++) {
    const w = outWords[i];
    out[i * 4] = w & 0xff;
    out[i * 4 + 1] = (w >>> 8) & 0xff;
    out[i * 4 + 2] = (w >>> 16) & 0xff;
    out[i * 4 + 3] = (w >>> 24) & 0xff;
  }
  return out;
}

// ── 2. Pure TypeScript SHA-256 Implementation ──────────────────────────────────
const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

export function sha256(data: Uint8Array): Uint8Array {
  const len = data.length;
  const bitLen = len * 8;
  const padLen = (((55 - (len % 64)) + 64) % 64) + 1;
  const totalLen = len + padLen + 8;
  const buf = new Uint8Array(totalLen);
  buf.set(data);
  buf[len] = 0x80;

  // Append big-endian 64-bit length
  buf[totalLen - 4] = (bitLen >>> 24) & 0xff;
  buf[totalLen - 3] = (bitLen >>> 16) & 0xff;
  buf[totalLen - 2] = (bitLen >>> 8) & 0xff;
  buf[totalLen - 1] = bitLen & 0xff;

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);

  for (let offset = 0; offset < totalLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      const idx = offset + i * 4;
      w[i] = (buf[idx] << 24) | (buf[idx + 1] << 16) | (buf[idx + 2] << 8) | buf[idx + 3];
    }
    for (let i = 16; i < 64; i++) {
      const s0 = ((w[i - 15] >>> 7) | (w[i - 15] << 25)) ^ ((w[i - 15] >>> 18) | (w[i - 15] << 14)) ^ (w[i - 15] >>> 3);
      const s1 = ((w[i - 2] >>> 17) | (w[i - 2] << 15)) ^ ((w[i - 2] >>> 19) | (w[i - 2] << 13)) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const s1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + SHA256_K[i] + w[i]) | 0;
      const s0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
    h5 = (h5 + f) | 0;
    h6 = (h6 + g) | 0;
    h7 = (h7 + h) | 0;
  }

  const out = new Uint8Array(32);
  const words = [h0, h1, h2, h3, h4, h5, h6, h7];
  for (let i = 0; i < 8; i++) {
    const v = words[i];
    out[i * 4] = (v >>> 24) & 0xff;
    out[i * 4 + 1] = (v >>> 16) & 0xff;
    out[i * 4 + 2] = (v >>> 8) & 0xff;
    out[i * 4 + 3] = v & 0xff;
  }
  return out;
}

// ── 3. Pure TypeScript RC4 Implementation ──────────────────────────────────────
export function rc4(key: Uint8Array, data: Uint8Array): Uint8Array {
  const s = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    s[i] = i;
  }

  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + s[i] + key[i % key.length]) & 0xff;
    const tmp = s[i];
    s[i] = s[j];
    s[j] = tmp;
  }

  let i = 0;
  j = 0;
  const out = new Uint8Array(data.length);
  for (let k = 0; k < data.length; k++) {
    i = (i + 1) & 0xff;
    j = (j + s[i]) & 0xff;
    const tmp = s[i];
    s[i] = s[j];
    s[j] = tmp;
    const val = s[(s[i] + s[j]) & 0xff];
    out[k] = data[k] ^ val;
  }
  return out;
}

// ── 4. Pure TypeScript AES-128 / AES-256 CBC Decryption ────────────────────────
// Standard AES S-Box and Inverse S-Box
const AES_INV_SBOX = new Uint8Array([
  0x52, 0x09, 0x6a, 0xd5, 0x30, 0x36, 0xa5, 0x38, 0xbf, 0x40, 0xa3, 0x9e, 0x81, 0xf3, 0xd7, 0xfb,
  0x7c, 0xe3, 0x39, 0x82, 0x9b, 0x2f, 0xff, 0x87, 0x34, 0x8e, 0x43, 0x44, 0xc4, 0xde, 0xe9, 0xcb,
  0x54, 0x7b, 0x94, 0x32, 0xa6, 0xc2, 0x23, 0x3d, 0xee, 0x4c, 0x95, 0x0b, 0x42, 0xfa, 0xc3, 0x4e,
  0x08, 0x2e, 0xa1, 0x66, 0x28, 0xd9, 0x24, 0xb2, 0x76, 0x5b, 0xa2, 0x49, 0x6d, 0x8b, 0xd1, 0x25,
  0x72, 0xf8, 0xf6, 0x64, 0x86, 0x68, 0x98, 0x16, 0xd4, 0xa4, 0x5c, 0xcc, 0x5d, 0x65, 0xb6, 0x92,
  0x6c, 0x70, 0x48, 0x50, 0xfd, 0xed, 0xb9, 0xda, 0x5e, 0x15, 0x46, 0x57, 0xa7, 0x8d, 0x9d, 0x84,
  0x90, 0xd8, 0xab, 0x00, 0x8c, 0xbc, 0xd3, 0x0a, 0xf7, 0xe4, 0x58, 0x05, 0xb8, 0xb3, 0x45, 0x06,
  0xd0, 0x2c, 0x1e, 0x8f, 0xca, 0x3f, 0x0f, 0x02, 0xc1, 0xaf, 0xbd, 0x03, 0x01, 0x13, 0x8a, 0x6b,
  0x3a, 0x91, 0x11, 0x41, 0x4f, 0x67, 0xdc, 0xea, 0x97, 0xf2, 0xcf, 0xce, 0xf0, 0xb4, 0xe6, 0x73,
  0x96, 0xac, 0x74, 0x22, 0xe7, 0xad, 0x35, 0x85, 0xe2, 0xf9, 0x37, 0xe8, 0x1c, 0x75, 0xdf, 0x6e,
  0x47, 0xf1, 0x1a, 0x71, 0x1d, 0x29, 0xc5, 0x89, 0x6f, 0xb7, 0x62, 0x0e, 0xaa, 0x18, 0xbe, 0x1b,
  0xfc, 0x56, 0x3e, 0x4b, 0xc6, 0xd2, 0x79, 0x20, 0x9a, 0xdb, 0xc0, 0xfe, 0x78, 0xcd, 0x5a, 0xf4,
  0x1f, 0xdd, 0xa8, 0x33, 0x88, 0x07, 0xc7, 0x31, 0xb1, 0x12, 0x10, 0x59, 0x27, 0x80, 0xec, 0x5f,
  0x60, 0x51, 0x7f, 0xa9, 0x19, 0xb5, 0x4a, 0x0d, 0x2d, 0xe5, 0x7a, 0x9f, 0x93, 0xc9, 0x9c, 0xef,
  0xa0, 0xe0, 0x3b, 0x4d, 0xae, 0x2a, 0xf5, 0xb0, 0xc8, 0xeb, 0xbb, 0x3c, 0x83, 0x53, 0x99, 0x61,
  0x17, 0x2b, 0x04, 0x7e, 0xba, 0x77, 0xd6, 0x26, 0xe1, 0x69, 0x14, 0x63, 0x55, 0x21, 0x0c, 0x7d,
]);

const AES_RCON = [0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];

const AES_SBOX = new Uint8Array([
  0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
  0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
  0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
  0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
  0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
  0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
  0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
  0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
  0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
  0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
  0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5e, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
  0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
  0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
  0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
  0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
  0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16,
]);

function expandAesKey(key: Uint8Array): Uint32Array {
  const keyLen = key.length; // 16 for AES-128, 32 for AES-256
  const nk = keyLen / 4;
  const nr = nk + 6;
  const w = new Uint32Array(4 * (nr + 1));

  for (let i = 0; i < nk; i++) {
    w[i] = (key[4 * i] << 24) | (key[4 * i + 1] << 16) | (key[4 * i + 2] << 8) | key[4 * i + 3];
  }

  for (let i = nk; i < 4 * (nr + 1); i++) {
    let temp = w[i - 1];
    if (i % nk === 0) {
      // RotWord + SubWord + Rcon
      const rot = (temp << 8) | (temp >>> 24);
      temp =
        (AES_SBOX[(rot >>> 24) & 0xff] << 24) |
        (AES_SBOX[(rot >>> 16) & 0xff] << 16) |
        (AES_SBOX[(rot >>> 8) & 0xff] << 8) |
        AES_SBOX[rot & 0xff];
      temp ^= AES_RCON[i / nk] << 24;
    } else if (nk > 6 && i % nk === 4) {
      // SubWord for AES-256
      temp =
        (AES_SBOX[(temp >>> 24) & 0xff] << 24) |
        (AES_SBOX[(temp >>> 16) & 0xff] << 16) |
        (AES_SBOX[(temp >>> 8) & 0xff] << 8) |
        AES_SBOX[temp & 0xff];
    }
    w[i] = w[i - nk] ^ temp;
  }
  return w;
}

function gmul(a: number, b: number): number {
  let p = 0;
  for (let i = 0; i < 8; i++) {
    if (b & 1) p ^= a;
    const hi = a & 0x80;
    a = (a << 1) & 0xff;
    if (hi) a ^= 0x1b;
    b >>>= 1;
  }
  return p;
}

function aesDecryptBlock(block: Uint8Array, w: Uint32Array, nr: number): Uint8Array {
  const state = new Uint8Array(16);
  state.set(block);

  // AddRoundKey with last round key
  for (let c = 0; c < 4; c++) {
    const k = w[nr * 4 + c];
    state[c * 4] ^= (k >>> 24) & 0xff;
    state[c * 4 + 1] ^= (k >>> 16) & 0xff;
    state[c * 4 + 2] ^= (k >>> 8) & 0xff;
    state[c * 4 + 3] ^= k & 0xff;
  }

  for (let round = nr - 1; round >= 0; round--) {
    // InvShiftRows
    const tmp1 = state[13]; state[13] = state[9]; state[9] = state[5]; state[5] = state[1]; state[1] = tmp1;
    const tmp2a = state[2]; const tmp2b = state[6]; state[2] = state[10]; state[6] = state[14]; state[10] = tmp2a; state[14] = tmp2b;
    const tmp3 = state[3]; state[3] = state[7]; state[7] = state[11]; state[11] = state[15]; state[15] = tmp3;

    // InvSubBytes
    for (let i = 0; i < 16; i++) {
      state[i] = AES_INV_SBOX[state[i]];
    }

    // AddRoundKey
    for (let c = 0; c < 4; c++) {
      const k = w[round * 4 + c];
      state[c * 4] ^= (k >>> 24) & 0xff;
      state[c * 4 + 1] ^= (k >>> 16) & 0xff;
      state[c * 4 + 2] ^= (k >>> 8) & 0xff;
      state[c * 4 + 3] ^= k & 0xff;
    }

    // InvMixColumns (not in round 0)
    if (round > 0) {
      for (let c = 0; c < 4; c++) {
        const s0 = state[c * 4];
        const s1 = state[c * 4 + 1];
        const s2 = state[c * 4 + 2];
        const s3 = state[c * 4 + 3];

        state[c * 4] = gmul(s0, 0x0e) ^ gmul(s1, 0x0b) ^ gmul(s2, 0x0d) ^ gmul(s3, 0x09);
        state[c * 4 + 1] = gmul(s0, 0x09) ^ gmul(s1, 0x0e) ^ gmul(s2, 0x0b) ^ gmul(s3, 0x0d);
        state[c * 4 + 2] = gmul(s0, 0x0d) ^ gmul(s1, 0x09) ^ gmul(s2, 0x0e) ^ gmul(s3, 0x0b);
        state[c * 4 + 3] = gmul(s0, 0x0b) ^ gmul(s1, 0x0d) ^ gmul(s2, 0x09) ^ gmul(s3, 0x0e);
      }
    }
  }

  return state;
}

export function aesCbcDecrypt(key: Uint8Array, iv: Uint8Array, ciphertext: Uint8Array): Uint8Array {
  const keyLen = key.length;
  const nr = keyLen === 32 ? 14 : keyLen === 24 ? 12 : 10;
  const w = expandAesKey(key);

  const numBlocks = Math.floor(ciphertext.length / 16);
  const out = new Uint8Array(numBlocks * 16);

  let prevIv = iv;

  for (let i = 0; i < numBlocks; i++) {
    const block = ciphertext.slice(i * 16, (i + 1) * 16);
    const decrypted = aesDecryptBlock(block, w, nr);

    for (let b = 0; b < 16; b++) {
      out[i * 16 + b] = decrypted[b] ^ prevIv[b];
    }
    prevIv = block;
  }

  // Remove PKCS#7 padding safely if present
  if (out.length > 0) {
    const padVal = out[out.length - 1];
    if (padVal >= 1 && padVal <= 16) {
      let isPadValid = true;
      for (let p = out.length - padVal; p < out.length; p++) {
        if (out[p] !== padVal) {
          isPadValid = false;
          break;
        }
      }
      if (isPadValid) {
        return out.slice(0, out.length - padVal);
      }
    }
  }

  return out;
}

// ── 5. PDF Standard Security Handler Parsing & Authentication ─────────────────
function parsePdfStringBytes(raw: string): Uint8Array {
  const clean = raw.trim();
  if (clean.startsWith('<') && clean.endsWith('>')) {
    const hex = clean.slice(1, -1).replace(/\s+/g, '');
    const len = Math.floor(hex.length / 2);
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = parseInt(hex.substr(i * 2, 2), 16) || 0;
    }
    return bytes;
  }
  if (clean.startsWith('(') && clean.endsWith(')')) {
    const content = clean.slice(1, -1);
    const bytes: number[] = [];
    for (let i = 0; i < content.length; i++) {
      if (content[i] === '\\' && i + 1 < content.length) {
        const next = content[i + 1];
        if (next === 'n') { bytes.push(10); i++; }
        else if (next === 'r') { bytes.push(13); i++; }
        else if (next === 't') { bytes.push(9); i++; }
        else if (next === 'b') { bytes.push(8); i++; }
        else if (next === 'f') { bytes.push(12); i++; }
        else if (next === '(' || next === ')' || next === '\\') { bytes.push(next.charCodeAt(0)); i++; }
        else if (/[0-7]/.test(next)) {
          let oct = next;
          if (i + 2 < content.length && /[0-7]/.test(content[i + 2])) oct += content[i + 2];
          if (i + 3 < content.length && /[0-7]/.test(content[i + 3])) oct += content[i + 3];
          bytes.push(parseInt(oct, 8));
          i += oct.length;
        } else {
          bytes.push(next.charCodeAt(0));
          i++;
        }
      } else {
        bytes.push(content.charCodeAt(i) & 0xff);
      }
    }
    return new Uint8Array(bytes);
  }
  return new Uint8Array(0);
}

export function extractPdfEncryptionInfo(pdfBytes: Uint8Array): PdfEncryptionInfo | null {
  const scanHead = String.fromCharCode.apply(null, Array.from(pdfBytes.slice(0, Math.min(pdfBytes.length, 65536))));
  const scanTail = String.fromCharCode.apply(null, Array.from(pdfBytes.slice(Math.max(0, pdfBytes.length - 32768))));
  const str = scanHead + '\n' + scanTail;

  if (!str.includes('/Encrypt')) {
    return null;
  }

  // 1. Extract /ID array
  let idFirst = new Uint8Array(16);
  const idMatch = str.match(/\/ID\s*\[\s*(<[^>]+>|\([^)]+\))/);
  if (idMatch && idMatch[1]) {
    const parsedId = parsePdfStringBytes(idMatch[1]);
    if (parsedId.length > 0) {
      idFirst = new Uint8Array(16);
      idFirst.set(parsedId.slice(0, 16));
    }
  }

  // 2. Find /Encrypt object
  const encRefMatch = str.match(/\/Encrypt\s+(\d+)\s+(\d+)\s+R/);
  let encDictStr = '';

  if (encRefMatch) {
    const objNum = encRefMatch[1];
    const genNum = encRefMatch[2];
    const objRegex = new RegExp(`${objNum}\\s+${genNum}\\s+obj([\\s\\S]*?)endobj`);
    const objMatch = str.match(objRegex);
    if (objMatch) {
      encDictStr = objMatch[1];
    }
  } else {
    const inlineMatch = str.match(/\/Encrypt\s*<<([\s\S]*?)>>/);
    if (inlineMatch) {
      encDictStr = inlineMatch[1];
    }
  }

  if (!encDictStr) {
    return null;
  }

  const filterMatch = encDictStr.match(/\/Filter\s*\/([A-Za-z0-9_]+)/);
  const vMatch = encDictStr.match(/\/V\s+(\d+)/);
  const rMatch = encDictStr.match(/\/R\s+(\d+)/);
  const lengthMatch = encDictStr.match(/\/Length\s+(\d+)/);
  const pMatch = encDictStr.match(/\/P\s+(-?\d+)/);

  const filter = filterMatch ? filterMatch[1] : 'Standard';
  const v = vMatch ? parseInt(vMatch[1], 10) : 1;
  const r = rMatch ? parseInt(rMatch[1], 10) : 2;
  const length = lengthMatch ? parseInt(lengthMatch[1], 10) : (v === 1 ? 40 : 128);
  const p = pMatch ? parseInt(pMatch[1], 10) : -4;

  const oMatch = encDictStr.match(/\/O\s*(<[^>]+>|\([^)]+\))/);
  const uMatch = encDictStr.match(/\/U\s*(<[^>]+>|\([^)]+\))/);
  const oeMatch = encDictStr.match(/\/OE\s*(<[^>]+>|\([^)]+\))/);
  const ueMatch = encDictStr.match(/\/UE\s*(<[^>]+>|\([^)]+\))/);
  const permsMatch = encDictStr.match(/\/Perms\s*(<[^>]+>|\([^)]+\))/);

  const o = oMatch ? parsePdfStringBytes(oMatch[1]) : new Uint8Array(32);
  const u = uMatch ? parsePdfStringBytes(uMatch[1]) : new Uint8Array(32);
  const oe = oeMatch ? parsePdfStringBytes(oeMatch[1]) : undefined;
  const ue = ueMatch ? parsePdfStringBytes(ueMatch[1]) : undefined;
  const perms = permsMatch ? parsePdfStringBytes(permsMatch[1]) : undefined;

  const encryptMetadata = !encDictStr.includes('/EncryptMetadata false');
  const isAes = encDictStr.includes('/AESV2') || encDictStr.includes('/AESV3') || v === 4 || v === 5;

  return {
    filter,
    v,
    r,
    length,
    p,
    o,
    u,
    oe,
    ue,
    perms,
    idFirst,
    encryptMetadata,
    isAes,
  };
}

export function computeEncryptionKeyR2toR4(
  passwordBytes: Uint8Array,
  encInfo: PdfEncryptionInfo
): Uint8Array {
  const keyLength = Math.floor(encInfo.length / 8);

  const paddedPassword = new Uint8Array(32);
  if (passwordBytes.length >= 32) {
    paddedPassword.set(passwordBytes.slice(0, 32));
  } else {
    paddedPassword.set(passwordBytes);
    paddedPassword.set(PDF_PASSWORD_PADDING.slice(0, 32 - passwordBytes.length), passwordBytes.length);
  }

  const p = encInfo.p;
  const pBytes = new Uint8Array([
    p & 0xff,
    (p >> 8) & 0xff,
    (p >> 16) & 0xff,
    (p >> 24) & 0xff,
  ]);

  const md5InputParts = [
    paddedPassword,
    encInfo.o,
    pBytes,
    encInfo.idFirst,
  ];

  if (encInfo.r >= 4 && !encInfo.encryptMetadata) {
    md5InputParts.push(new Uint8Array([0xff, 0xff, 0xff, 0xff]));
  }

  const totalLen = md5InputParts.reduce((sum, part) => sum + part.length, 0);
  const concat = new Uint8Array(totalLen);
  let offset = 0;
  for (const part of md5InputParts) {
    concat.set(part, offset);
    offset += part.length;
  }

  let digest = md5(concat);

  if (encInfo.r >= 3) {
    for (let i = 0; i < 50; i++) {
      digest = md5(digest.slice(0, keyLength));
    }
  }

  return digest.slice(0, keyLength);
}

export function authenticateUserPasswordR2toR4(
  password: string,
  encInfo: PdfEncryptionInfo
): { success: boolean; fileKey?: Uint8Array } {
  const passwordBytes = new TextEncoder().encode(password);
  const fileKey = computeEncryptionKeyR2toR4(passwordBytes, encInfo);

  if (encInfo.r === 2) {
    const testBytes = rc4(fileKey, PDF_PASSWORD_PADDING.slice());
    for (let i = 0; i < 32; i++) {
      if (testBytes[i] !== encInfo.u[i]) {
        return { success: false };
      }
    }
    return { success: true, fileKey };
  }

  if (encInfo.r >= 3 && encInfo.r <= 4) {
    const concat = new Uint8Array(32 + encInfo.idFirst.length);
    concat.set(PDF_PASSWORD_PADDING);
    concat.set(encInfo.idFirst, 32);

    let testBytes = md5(concat);

    for (let i = 0; i < 20; i++) {
      const iterKey = new Uint8Array(fileKey.length);
      for (let k = 0; k < fileKey.length; k++) {
        iterKey[k] = fileKey[k] ^ i;
      }
      testBytes = rc4(iterKey, testBytes);
    }

    for (let i = 0; i < 16; i++) {
      if (testBytes[i] !== encInfo.u[i]) {
        return { success: false };
      }
    }
    return { success: true, fileKey };
  }

  return { success: false };
}

export function authenticateUserPasswordR5R6(
  password: string,
  encInfo: PdfEncryptionInfo
): { success: boolean; fileKey?: Uint8Array } {
  const passwordBytes = new TextEncoder().encode(password);

  if (encInfo.u.length < 48) {
    return { success: false };
  }

  const userValidationSalt = encInfo.u.slice(32, 40);
  const userKeySalt = encInfo.u.slice(40, 48);
  const expectedHash = encInfo.u.slice(0, 32);

  const valConcat = new Uint8Array(passwordBytes.length + 8);
  valConcat.set(passwordBytes);
  valConcat.set(userValidationSalt, passwordBytes.length);

  const testHash = sha256(valConcat);
  for (let i = 0; i < 32; i++) {
    if (testHash[i] !== expectedHash[i]) {
      return { success: false };
    }
  }

  if (encInfo.ue && encInfo.ue.length >= 32) {
    const keyConcat = new Uint8Array(passwordBytes.length + 8);
    keyConcat.set(passwordBytes);
    keyConcat.set(userKeySalt, passwordBytes.length);

    const intermediateKey = sha256(keyConcat);
    const iv = new Uint8Array(16);

    const decryptedKey = aesCbcDecrypt(intermediateKey, iv, encInfo.ue.slice(0, 32));
    return { success: true, fileKey: decryptedKey.slice(0, 32) };
  }

  const keyConcat = new Uint8Array(passwordBytes.length + 8);
  keyConcat.set(passwordBytes);
  keyConcat.set(userKeySalt, passwordBytes.length);
  return { success: true, fileKey: sha256(keyConcat) };
}

export function verifyAndDerivePdfKey(
  pdfBytes: Uint8Array,
  password: string
): { success: boolean; encInfo?: PdfEncryptionInfo; fileKey?: Uint8Array; error?: string } {
  const encInfo = extractPdfEncryptionInfo(pdfBytes);
  if (!encInfo) {
    return { success: false, error: 'Document is not encrypted.' };
  }

  if (encInfo.r <= 4) {
    const res = authenticateUserPasswordR2toR4(password, encInfo);
    if (res.success && res.fileKey) {
      return { success: true, encInfo, fileKey: res.fileKey };
    }
    return { success: false, error: 'Incorrect password for this document.' };
  }

  if (encInfo.r >= 5) {
    const res = authenticateUserPasswordR5R6(password, encInfo);
    if (res.success && res.fileKey) {
      return { success: true, encInfo, fileKey: res.fileKey };
    }
    return { success: false, error: 'Incorrect password for this document.' };
  }

  return { success: false, error: `Unsupported PDF encryption revision: R${encInfo.r}` };
}

export function decryptPdfData(
  data: Uint8Array,
  objNum: number,
  genNum: number,
  encInfo: PdfEncryptionInfo,
  fileKey: Uint8Array
): Uint8Array {
  if (data.length === 0) return data;

  if (encInfo.r >= 5) {
    if (data.length <= 16) return data;
    const iv = data.slice(0, 16);
    const ciphertext = data.slice(16);
    try {
      return aesCbcDecrypt(fileKey, iv, ciphertext);
    } catch {
      return data;
    }
  }

  const isAes = encInfo.isAes;
  const suffixLen = isAes ? 9 : 5;
  const keyInput = new Uint8Array(fileKey.length + suffixLen);
  keyInput.set(fileKey);
  keyInput[fileKey.length] = objNum & 0xff;
  keyInput[fileKey.length + 1] = (objNum >> 8) & 0xff;
  keyInput[fileKey.length + 2] = (objNum >> 16) & 0xff;
  keyInput[fileKey.length + 3] = genNum & 0xff;
  keyInput[fileKey.length + 4] = (genNum >> 8) & 0xff;

  if (isAes) {
    keyInput[fileKey.length + 5] = 0x73; // 's'
    keyInput[fileKey.length + 6] = 0x41; // 'A'
    keyInput[fileKey.length + 7] = 0x6c; // 'l'
    keyInput[fileKey.length + 8] = 0x54; // 'T'
  }

  const objDigest = md5(keyInput);
  const objKeyLen = Math.min(fileKey.length + 5, 16);
  const objKey = objDigest.slice(0, objKeyLen);

  if (isAes) {
    if (data.length <= 16) return data;
    const iv = data.slice(0, 16);
    const ciphertext = data.slice(16);
    try {
      return aesCbcDecrypt(objKey, iv, ciphertext);
    } catch {
      return data;
    }
  }

  return rc4(objKey, data.slice());
}
