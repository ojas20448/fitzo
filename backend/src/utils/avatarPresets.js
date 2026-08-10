/**
 * The avatar presets a member may choose at signup.
 *
 * WHY THIS IS AN ALLOW-LIST AND NOT A FREE STRING
 * users.avatar_url is a VARCHAR that also holds Google profile photo URLs, so
 * the column happily accepts any string. If signup passed one straight through,
 * anyone could store a URL pointing at a server they control — the app renders
 * avatar_url in an <Image>, so every member who saw that profile would silently
 * make a request to it, handing over their IP and a rough location. That is a
 * tracking beacon dressed as a profile picture.
 *
 * Presets are keys, not URLs. The client resolves them to bundled assets, so
 * nothing is fetched over the network at all.
 *
 * MIRRORED IN mobile/src/components/Avatar.tsx (LOCAL_AVATARS). Adding a preset
 * means adding it in BOTH places — the asset has to be bundled client-side, and
 * the key has to be accepted server-side. A key accepted here with no matching
 * asset renders as the member's initials, which is a safe failure but a
 * confusing one.
 */

const AVATAR_PRESETS = Object.freeze([
    'avatar_zeus',
    'avatar_discobolus',
    'avatar_lion',
    'avatar_kettlebell',
    'avatar_trophy',
    'avatar_runner',
    'avatar_heart',
    'avatar_barbell',
]);

/** True for a value safe to store from untrusted input. */
function isPresetAvatar(value) {
    return typeof value === 'string' && AVATAR_PRESETS.includes(value);
}

module.exports = { AVATAR_PRESETS, isPresetAvatar };
