import crypto from "crypto";

// No fallback: minting sessions with a publicly known string would let anyone
// forge an agency token. Missing secret -> signing/verifying fails loudly.
const SECRET = process.env.DASHBOARD_PASSWORD || "";

function b64url(input) {
  return Buffer.from(input).toString("base64url");
}

// Sign a session payload with an HMAC the Edge middleware can verify.
export function signSession(payload) {
  if (!SECRET) throw new Error("DASHBOARD_PASSWORD is not set — cannot create sessions");
  const body = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifySession(token) {
  if (!token || !SECRET) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expect = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  if (sig.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString());
    if (p.exp && Date.now() > p.exp) return null;
    return p;
  } catch { return null; }
}

export function hashPassword(pw, salt) {
  const s = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(pw, s, 100000, 32, "sha256").toString("hex");
  return { hash, salt: s };
}

export function verifyPassword(pw, hash, salt) {
  if (!hash || !salt) return false;
  const h = crypto.pbkdf2Sync(pw, salt, 100000, 32, "sha256").toString("hex");
  return h.length === hash.length && crypto.timingSafeEqual(Buffer.from(h), Buffer.from(hash));
}
