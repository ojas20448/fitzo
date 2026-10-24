# Onboarding and spacing OTA — October 25, 2026

Published source `d685ae67aa56e7987002fdf0322800eed84fec77` to the existing
production channel without a new native build or store submission.

- Six-day gym/dumbbell starter plans now use distinct A/B session names. Live
  API logs confirmed duplicate names were rejected with `Choose distinct training days.`
- Setup shows the API's error message and retains a fallback for malformed errors.
- Profile activity cards have a 16-point gap; Food header padding is 24 points smaller.

All 81 mobile suites / 646 tests passed. TypeScript and scoped lint passed with
one existing Profile import warning. A local contract check accepted all 486
generated plans using the real backend validator. Browser checks confirmed the
card gap and no horizontal page overflow at 320 pixels.

Both platforms were published at 10%, their uploaded artifacts verified, then
expanded to 100%. Production protocol checks at **01:52 IST on October 25**
returned HTTP 200 and the new update IDs. Each downloaded Hermes bundle's SHA-256
matches its tested local export; all 219 referenced asset hashes match on each platform.
Asset downloads used the authorization headers supplied by the update protocol.

| Platform | Runtime / compatible build | Update ID | Group ID |
| --- | --- | --- | --- |
| Android | `74f8a38a9715cbcf5e8db7bf27d54ff5f3160d2f` / 33 | `01a16f91-fb91-7054-ac24-9b7dbfa08571` | `1bf59b53-e9c9-4779-915d-12acfc44b88e` |
| iOS | `9959efa4e5cc27c52444c51132f57715f133974b` / 30 | `01a16f92-f6b1-75f8-8dbc-a6f7e462ff76` | `150523b5-132f-44ab-8ebf-50c2a3d1800e` |

Android was generated with its original iOS build-number metadata of 29, as
documented in the prior timezone release. The original app.json was restored
after each operation. Fingerprint policy, dependencies, native configuration,
backend and database were retained.

For recovery, the prior Android group is `22f9c436-14b7-4492-89fe-b767373cf0f8`
and the prior iOS group is `92c3943b-0a3d-4f4d-8484-d8955b2d9eca`; these remain
available for republishing to their matching runtimes.

OTA eligibility requires these OTA-enabled binaries. Older installations need
the existing store update first. Delivery was verified; installation and native
behavior on the user's particular phone have not been verified.
