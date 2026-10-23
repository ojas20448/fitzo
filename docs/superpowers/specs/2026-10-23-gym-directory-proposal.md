# Gym discovery and Demo Gym — proposal

Date: 23 October 2026  
Status: Proposed app design. The Google Form and response sheet are created; app implementation has not started.

## Outcome

Help someone answer: **Which gym near me fits my training, budget and schedule?**

Add gym discovery inside Fitzo, with a clearly labelled **Demo Gym** that shows what a complete listing looks like. Gym owners volunteer their location for listing through a Google Form. A gym can publish membership prices or choose **Contact for pricing**.

## Created application form

- Owner account: `ojas4123narang@gmail.com` (confirmed through the connected account and Drive metadata).
- [Public application form](https://docs.google.com/forms/d/e/1FAIpQLSfQ1HUebu3jdabzqjmUtqMukw_Ds-aVSjsagoFuoDhGADgIww/viewform)
- [Form editor](https://docs.google.com/forms/d/10P7kmipM1sNj4OuuMDVbCVgdrw9cAXze5YAvJaRKHgs/edit)
- [Private response sheet](https://docs.google.com/spreadsheets/d/15yUVDob3G0GqRREDN4x2nV-sFjoqfrN1FAuQID-kX6Q/edit?usp=drivesdk)

The form is published for anyone with its link. Automatic Google-account email collection, the sign-in requirement for one response, and public response summaries are off. A required private email question has email-format validation. Response details remain private to the owner; applications require review before listing.

The 14 questions cover gym name; representative name/role; private email; optional private phone; city/locality; address and Maps pin; hours; optional equipment/activities/amenities; required pricing preference; optional membership prices; required authorised public business contact; optional photos/floor plan/tour links; visitor information; and required representative authorisation.

Only the explicitly designated public business contact can be published. The pricing preference overrides any prices supplied elsewhere in the application.

### Published form branding

The form now uses a Fitzo logo header, a black/white gym floor-plan motif with a pale-sage accent, Lexend for header/questions/body, charcoal `#111111` theme colour and a neutral light background. The introduction invites owners to describe their space and community while retaining the price-display choice and private/public contact distinction. The existing 14 questions and required-field settings remain in place.

The header was created with built-in Imagegen using the app icon as its reference. Asset and exact prompt: `docs/reviews/gym-directory-2026-10-23/fitzo-form-header.png` and `header-prompt.md`. Published-view screenshot: `docs/reviews/gym-directory-2026-10-23/form-branded.jpg`. The public view was checked after reload; no test application was submitted.

## Existing app behaviour to build on

`mobile/src/screens/member/GymHomeScreen.tsx` currently provides code-based membership, check-in/out, recorded app attendance, popular times and links to classes/friends. There is no browsable directory or gym profile endpoint. `backend/src/routes/gyms.js` currently restricts busy-times data to the caller's own gym.

The directory must work for members who have not connected a gym. Opening a listing never changes membership. Existing gym access codes and member attendance are not directory fields.

## First release

### Discover gyms

Use the existing Gym tab with two destinations: **My gym** and **Explore gyms**. Retain the current member tools in My gym. Explore gyms contains:

- **Use my location**, requested only when tapped, and a manual city/locality search.
- Nearby published listings, ordered by distance when location is available. Start with a 5 km radius and an explicit option to expand to 10 or 25 km.
- Cards showing name, photo, locality, approximate straight-line distance, hours and either a published membership price with its duration or **Contact for pricing**.
- Search by gym name/locality. Offer equipment and amenities filters once there are enough listings to make them useful.
- **Want your gym listed here? Apply to list your gym** linking to the created Google Form. Place it in the Gym tab and empty results state.
- A separate **Explore Demo Gym** card, available even before real gyms are onboarded.

If permission is denied, location services are off or location times out, keep manual search available. Do not repeatedly prompt. Never describe a manually searched locality as the user's current location. Never show a distance without actual coordinates. The directory contains approved participating gyms; it does not imply complete coverage of all nearby businesses.

### Gym detail

Present the most useful information in this order:

1. Name, representative photos, locality and a sample badge for Demo Gym.
2. Address, building/floor, opening hours, weekly closing days and holiday notices; a Directions action for real mapped locations.
3. Membership plans or **Contact for pricing**, plus public Call / WhatsApp / Email / Website actions when provided.
4. Equipment grouped into strength machines, free weights, cardio and functional training. Show useful specifics such as machine names, quantities and dumbbell range when supplied.
5. Activities and facilities: personal training, classes, lockers, showers, drinking water, parking, air conditioning and accessibility, based on owner-confirmed information.
6. Photos and any supplied floor plan or existing tour link.

Published prices must state currency and plan duration. Show joining fees, taxes, inclusions and validity when supplied. Missing or expired prices fall back to contacting the gym; never display zero or imply a free membership. A gym choosing contact pricing must have at least one approved public business contact.

Public browsing remains available without joining a gym in Fitzo. Existing code-based membership is an explicit separate action and does not buy a gym membership. Crowd information, member identities and workout activity stay subject to their existing membership/privacy rules.

## Demo Gym content

Demo Gym demonstrates the full profile using clearly labelled illustrative information:

- Sample hours: Monday–Saturday 6 am–10 pm; Sunday 7 am–1 pm.
- Sample prices: INR 1,500/month and an INR 200 day pass, both labelled example prices.
- Example equipment: two squat racks, cable crossover, lat pulldown, seated row, chest press, leg press, leg extension/curl, adjustable benches, dumbbells from 2.5–40 kg, four treadmills and two bikes.
- Example zones: reception, free weights, machines, cardio, stretching and changing rooms.
- Example activities: strength training, cardio, functional training and trainer-led sessions.

Show it separately from real nearby results. It has no fabricated distance, real-world address, bookable slot, contact number, reviews or live attendance. Opening the demo never joins the viewer to a database gym or affects attendance, streaks or leaderboards.

## Floor plan and 3D options

Three useful approaches, in increasing scope:

| Approach | Benefit | Requirement |
| --- | --- | --- |
| Photos / existing tour | Fastest way to understand a space | Owner-approved photos or a tour URL |
| Tappable 2D floor plan — recommended next | Find a machine and understand the zones | A checked floor plan and equipment positions |
| Interactive 3D gym | Rotate, zoom, select floors/zones and tap machines | A model or measured layout, assets and device testing |

Keep the full 3D tour as its own follow-up rather than making directory launch depend on model production. Start with a labelled Demo Gym layout; real gyms need verified assets. Each machine hotspot should expose its name, target muscles, setup/safety cues, exercise demonstration and suitable alternatives. Keep the equipment list accessible without interacting with a map. Load a tour only on demand and retain a 2D/photo fallback.

React Three Fiber documents native support through `@react-three/fiber/native` and Expo GL; this is a feasibility option, not a tested dependency choice for this app. The installed app has React 19 and does not currently include the 3D stack. Validate an Expo-compatible prototype on Android and iOS before choosing that approach.

## Other valuable follow-ups

- **Can I do my workout here?** Compare a saved workout with confirmed equipment and offer substitutions. Generic equipment tags alone are insufficient to distinguish every machine.
- Saved gyms and a comparison of price, distance, hours and equipment.
- Trial/day-pass enquiries and gym-confirmed trainer/class schedules.
- Equipment maintenance notices, with an update date and responsible source.
- Owner-confirmed listing updates, a visible last-checked date, and a way to report incorrect details.

Machine presence is not evidence that a machine is free right now. Live machine availability, booking, payments and public member activity need separate data and product decisions.

## Proposed implementation boundaries

1. Add a small additive migration for gym listings. A listing may optionally link to an existing integrated gym; independent listed businesses should not require a membership access code. Store published location, hours, contacts, equipment, price mode/plans, media and publication status. Keep private applications in the response sheet for the initial manually reviewed pilot.
2. Add directory list/detail reads returning an explicit allowlist of public fields. Use a separate directory route so existing own-gym busy-times protection stays intact. Only approved/published listings are discoverable.
3. Support a validated nearby query and manual city/locality search, bounded result counts and sensible radius limits. A first small directory can use PostgreSQL distance calculations without introducing a geospatial service. Mark distances as approximate, not driving distances.
4. Add the Explore experience, profile route and isolated Demo Gym fixture using the current components/theme. Wire the Google Form URL through the existing external-linking pattern, with a helpful error when opening fails.
5. Add foreground-only device location through an Expo-compatible package if needed; `expo-location` is not installed. Do not request background location or retain the user's position in their profile/analytics. Ensure request logging does not record precise coordinates. Update native permission copy and validate a rebuilt development client.
6. Manually review form submissions, verify the gym's business location/contact and pricing preference, then publish through the existing operator workflow or a small repeatable import. Automatic publication and an owner management dashboard are later work.

## Acceptance and validation

- A member with no connected gym can discover approved listings and open Demo Gym.
- Location granted/denied/disabled/timeout states all have a usable path; manual area search works without location permission.
- Nearby ordering and radius boundaries are correct, and Demo Gym is excluded from real distances.
- Public-price and contact-price cards/details agree. Contact mode never exposes supplied private prices. Missing data and expired prices are handled explicitly.
- Opening a profile does not alter membership; existing join/check-in/out flows keep working.
- Directory responses never expose access codes, form applicants' private contact details, member identities, attendance or private workouts. Draft/unlisted records are not readable through directory detail links.
- The form link opens on Android/iOS; a failed open provides a retry/copy option. Public phone/web actions use validated destinations.
- Profile and results work with large text, screen readers, narrow screens and slow/offline requests. Missing images and empty results remain usable.
- Run focused backend route/data tests, mobile interaction tests and type checking after implementation. Check native location permission behaviour on devices; a web preview does not establish native readiness.

## Evidence and references

- The published form's respondent view showed all 14 questions, the nine required questions, and both pricing options. Editor settings showed automatic email collection off, one-response sign-in off and response summary sharing off. Drive readback confirmed ownership and the private response sheet.
- No test application was submitted. The form's end-to-end submission/confirmation and native app flow have not been exercised.
- Screenshot: `docs/reviews/gym-directory-2026-10-23/form-published.jpg`.
- [Expo: linking into other apps](https://docs.expo.dev/linking/into-other-apps/)
- [Expo: device location](https://docs.expo.dev/versions/latest/sdk/location/)
- [React Three Fiber: native installation and React compatibility](https://r3f.docs.pmnd.rs/getting-started/installation)
