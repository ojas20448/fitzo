/**
 * Verify a Sign in with Apple identity token.
 *
 * Apple requires this: App Store Review Guideline 4.8 says an app offering a
 * third-party sign-in (Fitzo offers Google) must also offer an equivalent
 * privacy-preserving option. Shipping to the App Store without it is a
 * guaranteed rejection.
 *
 * No new dependency: Node can build a public key straight from a JWK via
 * crypto.createPublicKey({ format: 'jwk' }), so jsonwebtoken — already a
 * dependency — does the rest. Pulling in jwks-rsa or apple-signin-auth would
 * add a package to verify five fields.
 *
 * The token is a standard RS256 JWT. Three things must be checked and all
 * three matter:
 *   - signature, against Apple's published JWKS (rotates, so it is refetched)
 *   - `iss` is exactly https://appleid.apple.com
 *   - `aud` is our own bundle ID — without this, a token minted for ANY other
 *     Apple developer's app would authenticate here. This is the same class of
 *     bug that broke Google sign-in.
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_KEYS_URL = 'https://appleid.apple.com/auth/keys';

// Apple rotates signing keys without notice, so the set cannot be baked in.
// Cached for an hour: long enough to avoid a fetch per sign-in, short enough
// that a rotation heals on its own. A cache miss on an unknown `kid` also
// forces an immediate refetch below, so rotation never causes a sustained
// outage — at worst one sign-in pays for the refresh.
let keyCache = { keys: null, fetchedAt: 0 };
const KEY_TTL_MS = 60 * 60 * 1000;

async function fetchAppleKeys(force = false) {
    const fresh = Date.now() - keyCache.fetchedAt < KEY_TTL_MS;
    if (!force && keyCache.keys && fresh) return keyCache.keys;

    const res = await fetch(APPLE_KEYS_URL);
    if (!res.ok) throw new Error(`Apple JWKS fetch failed: ${res.status}`);
    const body = await res.json();
    if (!Array.isArray(body.keys) || body.keys.length === 0) {
        throw new Error('Apple JWKS response contained no keys');
    }
    keyCache = { keys: body.keys, fetchedAt: Date.now() };
    return keyCache.keys;
}

async function publicKeyForKid(kid) {
    let keys = await fetchAppleKeys();
    let jwk = keys.find((k) => k.kid === kid);

    // Unknown kid almost always means Apple rotated since the last fetch.
    // Refetch once before giving up.
    if (!jwk) {
        keys = await fetchAppleKeys(true);
        jwk = keys.find((k) => k.kid === kid);
    }
    if (!jwk) throw new Error(`No Apple signing key matches kid ${kid}`);

    return crypto.createPublicKey({ key: jwk, format: 'jwk' });
}

/**
 * @param {string} identityToken The JWT from expo-apple-authentication.
 * @returns {Promise<{appleId: string, email: string|null, emailVerified: boolean, isPrivateEmail: boolean}>}
 */
async function verifyAppleToken(identityToken) {
    if (!identityToken || typeof identityToken !== 'string') {
        throw new Error('Apple identity token is required');
    }

    const decoded = jwt.decode(identityToken, { complete: true });
    if (!decoded?.header?.kid) throw new Error('Apple identity token is malformed');

    const key = await publicKeyForKid(decoded.header.kid);

    // Accept both the app bundle ID and the Services ID. A native iOS sign-in
    // carries the bundle ID; a web/Android flow through Apple's OAuth endpoint
    // carries the Services ID. Empty entries are stripped so an unset env var
    // cannot widen the audience to `undefined` and match nothing safely.
    const audiences = [
        process.env.APPLE_BUNDLE_ID || 'com.fitzo.app',
        process.env.APPLE_SERVICES_ID,
    ].filter(Boolean);

    const payload = jwt.verify(identityToken, key, {
        algorithms: ['RS256'],
        issuer: APPLE_ISSUER,
        audience: audiences,
    });

    // `email_verified` and `is_private_email` arrive as the STRINGS "true" /
    // "false" from Apple, not booleans. Comparing them loosely would make
    // "false" truthy and silently accept an unverified address.
    const asBool = (v) => v === true || v === 'true';

    return {
        appleId: payload.sub,
        email: payload.email ? String(payload.email).trim().toLowerCase() : null,
        emailVerified: asBool(payload.email_verified),
        isPrivateEmail: asBool(payload.is_private_email),
    };
}

module.exports = { verifyAppleToken };
