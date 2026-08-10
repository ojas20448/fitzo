/**
 * Brand shell for transactional email.
 *
 * Both emails Fitzo sends — the password-reset code and the manager's
 * temporary-credentials mail — were written independently and drifted to the
 * same wrong place: slate `#0f172a` with indigo `#6366f1`, which is Tailwind's
 * default palette, not Fitzo's. The app is pure black and white with NO accent
 * colour at all. A locked-out member's first sight of the product looked like a
 * different product.
 *
 * One shell, so they cannot drift again.
 *
 * EMAIL IS NOT THE APP — three constraints the in-app styles ignore:
 *
 *   1. No web fonts. Outlook, Gmail web and most mobile clients will not load
 *      Lexend, so it is listed first and Helvetica carries the fallback. A
 *      "distinctive" display face here renders as whatever the client feels
 *      like, which is worse than a predictable one.
 *   2. No rgba(). Several clients drop it, taking the text with it, so the
 *      app's rgba whites are pre-flattened against black to solid hex.
 *   3. Inline styles only. No <style> block, no classes — Gmail strips them.
 */

// The app's rgba whites, flattened against #000000 for clients without alpha.
const INK = '#FFFFFF';                 // colors.text.primary
const INK_SECONDARY = '#B3B3B3';       // rgba(255,255,255,0.70) on black
const INK_MUTED = '#8C8C8C';           // rgba(255,255,255,0.55) on black
const CANVAS = '#000000';              // colors.background
const SURFACE = '#0A0A0A';             // colors.surface
const BORDER = '#1F1F1F';              // ~rgba(255,255,255,0.10) on black

const FONT = "'Lexend', 'Helvetica Neue', Helvetica, sans-serif";

/**
 * @param {object} opts
 * @param {string} opts.heading    the one-line title
 * @param {string} opts.intro      paragraph above the emphasised block
 * @param {string} [opts.code]     the code / password to emphasise
 * @param {string} [opts.outro]    paragraph below it
 * @param {string} [opts.footnote] small print
 */
function renderEmail({ heading, intro, code, outro, footnote }) {
    return `
<div style="background:${CANVAS};padding:32px 0;">
  <div style="font-family:${FONT};max-width:480px;margin:0 auto;padding:32px;background:${CANVAS};color:${INK};border:1px solid ${BORDER};border-radius:16px;">
    <div style="font-size:13px;letter-spacing:0.18em;color:${INK_MUTED};text-transform:uppercase;margin-bottom:24px;">FITZO</div>
    <h1 style="font-size:24px;line-height:1.25;margin:0 0 12px 0;color:${INK};font-weight:700;">${heading}</h1>
    <p style="color:${INK_SECONDARY};font-size:15px;line-height:1.6;margin:0 0 28px 0;">${intro}</p>
    ${code ? `
    <div style="background:${SURFACE};border:1px solid ${BORDER};border-radius:12px;padding:24px;text-align:center;letter-spacing:0.28em;font-size:34px;font-weight:700;color:${INK};">
      ${code}
    </div>` : ''}
    ${outro ? `<p style="color:${INK_SECONDARY};font-size:15px;line-height:1.6;margin:28px 0 0 0;">${outro}</p>` : ''}
    ${footnote ? `<p style="color:${INK_MUTED};font-size:13px;line-height:1.5;margin:24px 0 0 0;">${footnote}</p>` : ''}
  </div>
</div>`.trim();
}

module.exports = { renderEmail };
