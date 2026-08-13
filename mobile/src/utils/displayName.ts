/**
 * Never show an email address where a human name belongs.
 *
 * Registration takes `name` as free text, so accounts exist whose `name` column
 * holds an email address. Rendering that raw leaks the address onto the home
 * screen and the profile header. Rather than migrate the data (which cannot
 * recover a real name anyway), guard at the display layer: if the stored name
 * looks like an email, fall back to the username, else derive something
 * readable from the local part.
 *
 *   displayName({ name: 'ojas@gmail.com', username: 'ojas4123' })  -> 'ojas4123'
 *   displayName({ name: 'ojas.narang@x.io' })                      -> 'Ojas Narang'
 *   displayName({ name: 'Ojas Narang' })                           -> 'Ojas Narang'
 */

export interface NameSource {
    name?: string | null;
    username?: string | null;
}

// Deliberately loose: this decides "does this look like an address to a
// reader", not "is this deliverable". Anything with an @ and a dotted domain
// after it should never be rendered as a name.
const EMAIL_SHAPED = /^\S+@\S+\.\S+$/;

export function looksLikeEmail(value: string | null | undefined): boolean {
    if (!value) return false;
    return EMAIL_SHAPED.test(value.trim());
}

/** Turn an email local part into something presentable: ojas.narang -> Ojas Narang */
function humanizeLocalPart(localPart: string): string {
    return localPart
        .replace(/[._-]+/g, ' ')
        // Strip trailing digits people append to addresses (ojas4123 -> ojas),
        // but only when letters remain — "123" alone stays as-is.
        .replace(/(\p{L})\d+\b/gu, '$1')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

export function displayName(user: NameSource | null | undefined, fallback = 'Member'): string {
    const name = user?.name?.trim();
    const username = user?.username?.trim();

    if (name && !looksLikeEmail(name)) return name;

    // The stored name is unusable. A username is user-chosen and safe to show,
    // unless it too is an address.
    if (username && !looksLikeEmail(username)) return username;

    if (name && looksLikeEmail(name)) {
        const humanized = humanizeLocalPart(name.split('@')[0]);
        if (humanized) return humanized;
    }

    return fallback;
}

/** First name only, for greetings ("Hey Ojas"). */
export function firstName(user: NameSource | null | undefined, fallback = 'there'): string {
    const full = displayName(user, '');
    if (!full) return fallback;
    return full.split(' ')[0];
}
