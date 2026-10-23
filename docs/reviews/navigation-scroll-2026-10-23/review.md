# Navigation scroll and glass refinement — October 23, 2026

The user's latest direction adds scroll minimization to the existing five-tab navigation. All five destinations share the same scroll handler. Below 48 points of scroll the labels remain visible; 24 points of downward travel minimizes the bar. An upward movement of 16 points, returning within 8 points of the top, refocusing a screen or pressing a tab restores the full bar. Small direction changes, edge bounce and inactive-screen scroll events cannot repeatedly toggle it.

The capsule animates from its existing expanded height (64 points at default text size) to 54 points over 200 ms. Labels fade and collapse while the icons remain centred. Reduced Motion changes the layout immediately. Tabs keep their full accessibility names, selected state and at least 44-point-high targets. Expanded content padding stays reserved throughout the transition so the last row remains reachable without changing the list's scroll range. The resume-workout banner, keyboard hiding, navigation events and existing screen state remain intact.

Glass refinements use the installed Expo dependencies: less tint over native iOS glass, a clearer blur on supported older iOS/web clients, diagonal specular highlights and brighter capsule/selection rims. Android and older binaries retain a lightly translucent, shaded fallback; Reduce Transparency uses the opaque surface. No dependencies were added.

## Research

- [Apple Design by SudewaJay](https://github.com/SudewaJay/apple-design-skill) describes the current floating functional layer and minimum target sizes.
- [Apple Design's Liquid Glass guidance by dickwu](https://github.com/dickwu/apple-design-skill/blob/main/references/hig/liquid-glass.md) supports restrained glass on navigation, regular material for text-bearing controls, native accessibility settings and a conservative Android fallback.
- [Callstack Liquid Glass](https://github.com/callstack/liquid-glass) supplies another iOS-native implementation. The existing `expo-glass-effect` already covers the required native material, so a second library is unnecessary.
- Native props were checked against the installed `expo-glass-effect` types rather than assuming the latest Expo API matches SDK 54.

## Verification

- Mobile Jest suite: **75 suites, 587 tests passed**. Four added navigation tests cover scroll direction thresholds, edge bounce, short content, inactive-screen events, focus restoration, label collapse, accessible tabs, minimum target heights and stable content insets.
- TypeScript passes. Lint reports no errors; the touched older screens retain 20 existing warnings. The shared navigation components and hook pass scoped lint without warnings.
- Actual Metro app checked in isolated Chromium contexts with synthetic API responses at 320, 390 and 430 pixels wide. The 430-pixel check uses Reduced Motion. Wheel scrolling collapses and restores the bar; switching to Gym expands it; compact labels have zero opacity. Minimum target height is 44 pixels, with widths from 57.18 pixels on the smallest viewport. No horizontal overflow occurs in compact mode.
- All external traffic is blocked in the browser harness. The recorded jsQR CDN worker error is caused by that block; no additional application page errors occurred. No API mutations were requested.
- [Expanded, 390px](./expanded-390.png), [compact, 390px](./compact-390.png), [compact, 320px](./compact-320.png), [compact with Reduced Motion, 430px](./compact-430.png), [browser measurements](./browser-results.json).

The temporary verification harness is `C:/Users/PC/AppData/Local/Temp/fitzo-nav-scroll-review.cjs`. Native iOS material optics, physical-device frame pacing and screen-reader use remain unverified.
