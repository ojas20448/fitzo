/**
 * Print the Android signing SHA-1 fingerprints held by EAS.
 *
 * `eas credentials` is an interactive TUI, so it cannot be run from a script,
 * a CI job, or an agent session. This queries the same data over the EAS
 * GraphQL API using the session already stored by `eas login`.
 *
 *   cd mobile && node scripts/print-android-sha1.mjs
 *
 * ── The thing to understand about these fingerprints ────────────────────────
 * What this prints is the **upload key** — the key EAS signs builds with. With
 * Play App Signing enabled, Google RE-SIGNS the app with its own key before
 * distributing it, so an install from Play carries a different signature from
 * the identical build installed as an APK.
 *
 * Google Sign-In validates against the signature of the installed app, so BOTH
 * must be registered on the Android OAuth client or sign-in works in one
 * distribution channel and fails with DEVELOPER_ERROR in the other.
 *
 * The Play app signing key is NOT obtainable here — the Android Publisher API
 * does not expose signing certificates. Read it from:
 *   Play Console -> Test and release -> Setup -> App integrity -> App signing
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

const ACTIVE_PACKAGE = 'com.fitzo.app';   // must match android.package in app.json
const EAS_PROJECT_ID = '30c3c5e6-e055-4640-9daa-ae04f9c32ac8';

const statePath = path.join(os.homedir(), '.expo', 'state.json');
if (!fs.existsSync(statePath)) {
    console.error('Not logged in to EAS. Run: npx eas login');
    process.exit(1);
}

const sessionSecret = JSON.parse(fs.readFileSync(statePath, 'utf8'))?.auth?.sessionSecret;
if (!sessionSecret) {
    console.error('No EAS session found in ~/.expo/state.json. Run: npx eas login');
    process.exit(1);
}

const query = `
  query($appId: String!) {
    app {
      byId(appId: $appId) {
        fullName
        androidAppCredentials {
          applicationIdentifier
          androidAppBuildCredentialsList {
            isDefault
            androidKeystore { sha1CertificateFingerprint }
          }
        }
      }
    }
  }`;

const res = await fetch('https://api.expo.dev/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'expo-session': sessionSecret },
    body: JSON.stringify({ query, variables: { appId: EAS_PROJECT_ID } }),
});

const body = await res.json();
if (body.errors) {
    console.error('EAS API error:', body.errors.map((e) => e.message).join('; '));
    process.exit(1);
}

const app = body.data?.app?.byId;
if (!app) {
    console.error('No app returned for project', EAS_PROJECT_ID);
    process.exit(1);
}

// Google Cloud Console expects colon-separated uppercase hex.
const format = (hex) => hex.toUpperCase().match(/.{2}/g).join(':');

console.log(`\nEAS project: ${app.fullName}\n`);

let foundActive = false;
for (const cred of app.androidAppCredentials) {
    for (const build of cred.androidAppBuildCredentialsList) {
        const sha1 = build.androidKeystore?.sha1CertificateFingerprint;
        if (!sha1) continue;
        const isActive = cred.applicationIdentifier === ACTIVE_PACKAGE;
        if (isActive) foundActive = true;
        console.log(
            `  ${cred.applicationIdentifier.padEnd(20)} ${format(sha1)}` +
            (isActive ? '   <-- REGISTER THIS' : '   (stale package, ignore)')
        );
    }
}

if (!foundActive) {
    console.log(`\n  WARNING: no credentials found for ${ACTIVE_PACKAGE}.`);
    console.log('  Either no Android build has run for this package yet, or the');
    console.log('  package name in app.json changed without a rebuild.');
}

console.log(`
  Register the marked fingerprint at
    https://console.cloud.google.com/apis/credentials
  on your Android OAuth client, package name ${ACTIVE_PACKAGE}.

  Then add the SECOND fingerprint — the Play app signing key — from
    Play Console -> Test and release -> Setup -> App integrity -> App signing
  Both are required. See OWNER_ACTIONS.md section 6.
`);
