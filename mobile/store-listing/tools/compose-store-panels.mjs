/** Reproducible, local-only App Store artwork. Keeps original artwork intact. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { chromium, sharp } from './dependencies.mjs';
import { panels, targets, metadata } from './campaign.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MOBILE = path.resolve(HERE, '../..');
const OUT = path.resolve(HERE, '../refresh-2026-09');
const W = 1080, H = 2346;
const uri = (file, type = 'image/png') => `data:${type};base64,${fs.readFileSync(file).toString('base64')}`;
const regular = uri(path.join(MOBILE, 'assets/fonts/Lexend-Regular.ttf'), 'font/ttf');
const bold = uri(path.join(MOBILE, 'assets/fonts/Lexend-Bold.ttf'), 'font/ttf');
const esc = s => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const sources = panels.map(p => path.join(MOBILE, 'store-screenshots', p.fresh ? 'store-refresh' : 'device', `${p.source}.png`));
if (panels.some(p => p.theme !== 'paper')) throw new Error('The full campaign must use the unified light theme.');
for (const source of sources) if (!fs.existsSync(source)) throw new Error(`Missing capture: ${source}`);
for (const [key, limit] of Object.entries({ name: 30, subtitle: 30, promotionalText: 170, keywords: 100 })) {
  if ([...metadata[key]].length > limit) throw new Error(`${key} exceeds ${limit} characters`);
}
fs.mkdirSync(OUT, { recursive: true });

// One continuous path in carousel coordinates. Every panel is a window onto
// the same artwork, so neither the position nor the tangent resets at seams.
let ribbonPath = 'M 0 1430';
for (let i = 0; i < panels.length; i++) {
  const x = i * W, y0 = i % 2 ? 1130 : 1430, y1 = i % 2 ? 1430 : 1130;
  ribbonPath += ` C ${x + W / 3} ${y0} ${x + W * 2 / 3} ${y1} ${x + W} ${y1}`;
}
function ribbon(index, span = 1) {
  return `<svg class="ribbon" aria-hidden="true" width="${W * span}" height="${H}" viewBox="${index * W} 0 ${W * span} ${H}" xmlns="http://www.w3.org/2000/svg"><g fill="none"><path d="${ribbonPath}" stroke="#dce83a" stroke-width="112"/><path d="${ribbonPath}" transform="translate(0,-165)" stroke="#c8cbbd" stroke-width="2"/><path d="${ribbonPath}" transform="translate(0,165)" stroke="#c8cbbd" stroke-width="2"/></g></svg>`;
}

const css = `
@font-face{font-family:Lexend;src:url('${regular}');font-weight:400}
@font-face{font-family:Lexend;src:url('${bold}');font-weight:700}
*{box-sizing:border-box}html,body{margin:0;background:#f3f1e9;font-family:Lexend,sans-serif}
.art{position:relative;width:${W}px;height:${H}px;overflow:hidden;isolation:isolate;--fg:#171816;--muted:#595b52;--accent:#dce83a;--bg:#f3f1e9;background:var(--bg);color:var(--fg)}
.brand{position:absolute;top:76px;left:76px;font-size:48px;font-weight:700;letter-spacing:-3px;display:flex;align-items:center;gap:12px}
.brand b{width:12px;height:12px;border-radius:50%;background:var(--accent);margin-top:15px}
.count{position:absolute;right:78px;top:99px;font-size:18px;letter-spacing:3px;color:var(--muted)}
.copy{position:absolute;left:76px;right:60px;top:217px;z-index:4}
.eyebrow{font-size:20px;font-weight:700;letter-spacing:3.5px;margin-bottom:31px}
.eyebrow:before{content:'';display:inline-block;width:28px;height:4px;background:currentColor;vertical-align:middle;margin-right:16px}
h1{font-size:103px;line-height:1.04;letter-spacing:-5.5px;margin:0;font-weight:700}
h1 span{display:block;white-space:nowrap}
.support{font-size:34px;font-weight:700;line-height:1.4;letter-spacing:-.4px;margin-top:29px;max-width:890px;color:#393c33}
.ribbon{position:absolute;left:0;top:0;z-index:-1}
.display{position:absolute;left:116px;top:695px;width:848px;padding:12px;background:linear-gradient(135deg,#65685d,#1d201b 25%,#080908 65%,#727668);border:1px solid #92958b;border-radius:48px;box-shadow:0 44px 64px #0005,10px 8px 0 #242820;transform:rotate(var(--angle));transform-origin:50% 25%;z-index:2}
.screen{border-radius:35px;overflow:hidden;background:#000}
.screen img{display:block;width:100%;height:auto}
.map .display{top:850px;width:940px;left:70px}
.map .screen{height:1120px}
.map img{margin-top:-837px}
.map .display:before{content:'DETAIL FROM YOUR WEEKLY REPORT';position:absolute;top:-69px;left:10px;color:var(--muted);font-size:20px;font-weight:700;letter-spacing:2px}
.coach .display{width:940px;left:70px;top:850px}
.coach .screen{height:1220px}
.coach img{margin-top:-780px}
.coach .display:before{content:'DETAIL FROM A SPOTTER CONVERSATION';position:absolute;top:-69px;left:10px;color:var(--muted);font-size:20px;font-weight:700;letter-spacing:2px}
.footer{position:absolute;bottom:0;left:0;right:0;height:138px;padding:70px 76px 0;background:linear-gradient(transparent,var(--bg) 49%);z-index:5;font-size:16px;letter-spacing:2.2px;font-weight:700}
.footer small{display:block;font-weight:400;font-size:13px;letter-spacing:.2px;margin-top:9px;color:var(--muted)}
.split .display{width:1510px;left:325px;top:750px;transform:rotate(-6deg)}
.split .screen img{margin-top:-300px}
`;
function html(panel, index, target, { split = false } = {}) {
  const ratio = target.width / W;
  const second = index % 2 === 1;
  const screenshot = uri(sources[index]);
  return `<!doctype html><html lang="en"><meta charset="utf-8"><style>${css}
html,body{width:${target.width}px;height:${target.height}px;overflow:hidden}
.art{transform:scale(${ratio});transform-origin:top left;height:${target.height / ratio}px}
</style><div class="art ${panel.theme} ${second ? 'right' : ''} ${panel.crop || ''} ${split ? 'split' : ''}" style="--angle:${panel.angle}deg">
${ribbon(split ? 0 : index, split ? 2 : 1)}<div class="brand">fitzo<b></b></div><div class="count">${String(index + 1).padStart(2, '0')} / 08</div>
<div class="copy"><div class="eyebrow">${esc(panel.eyebrow)}</div><h1>${panel.title.map(t => `<span>${esc(t)}</span>`).join('')}</h1><div class="support">${esc(panel.support)}</div></div>
<div class="display"><div class="screen"><img alt="Fitzo ${esc(panel.eyebrow)}" src="${screenshot}"></div></div>
<div class="footer">${esc(panel.tag)}${panel.sample ? '<small>Example conversation · AI responses vary.</small>' : ''}</div></div></html>`;
}

const browser = await chromium.launch();
const manifest = { generatedAt: new Date().toISOString(), metadata, sourceType: 'Actual Expo web UI captures, with demo data. Native appearance requires owner comparison before upload.', outputs: [] };
try {
  for (const target of targets) {
    const dir = path.join(OUT, target.key);
    fs.mkdirSync(dir, { recursive: true });
    const page = await browser.newPage({ viewport: { width: target.width, height: target.height }, deviceScaleFactor: 1 });
    for (const [i, panel] of panels.entries()) {
      await page.setContent(html(panel, i, target));
      await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode())); });
      const issues = await page.evaluate(() => {
        const art = document.querySelector('.art').getBoundingClientRect();
        return [...document.querySelectorAll('h1 span,.eyebrow,.support')].filter(e => {
          const r = e.getBoundingClientRect();
          return r.right > art.right - 20 || e.scrollWidth > e.clientWidth + 1;
        }).map(e => e.textContent);
      });
      if (issues.length) throw new Error(`Text overflow on ${panel.file}: ${issues.join(', ')}`);
      const output = path.join(dir, `${panel.file}.png`);
      const buffer = await page.screenshot();
      await sharp(buffer).flatten({ background: '#f3f1e9' }).removeAlpha().png().toFile(output);
      const info = await sharp(output).metadata();
      if (info.width !== target.width || info.height !== target.height || info.hasAlpha) throw new Error(`Invalid export ${output}`);
      manifest.outputs.push({ file: path.relative(OUT, output).replaceAll('\\', '/'), width: info.width, height: info.height, hasAlpha: info.hasAlpha, source: path.relative(MOBILE, sources[i]).replaceAll('\\', '/'), sourceSHA256: crypto.createHash('sha256').update(fs.readFileSync(sources[i])).digest('hex') });
    }
    await page.close();
    console.log(`Rendered and checked ${panels.length} opaque PNGs: ${target.key}`);
  }
  // Optional true split-screen composition: one wide canvas, then exact cuts.
  // A generic screen frame, not an altered Apple product image.
  const splitDir = path.join(OUT, 'optional-split-pair');
  fs.mkdirSync(splitDir, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 2640, height: 2868 }, deviceScaleFactor: 1 });
  const base = html(panels[5], 5, { width: 1320, height: 2868 }, { split: true });
  const pair = base.replace('<div class="art paper right ', '<div class="art paper split ')
    .replace('html,body{width:1320px;', 'html,body{width:2640px;')
    .replace('</style>', '.art{width:2160px}.copy{right:auto;width:928px}.count{display:none}.brand{z-index:4}.footer{display:none}.display{left:430px!important;top:700px!important;width:1300px!important;transform:rotate(-6deg)!important}</style>')
    .replace('YOUR DAILY OVERVIEW', 'WORKOUTS + NUTRITION')
    .replace('<span>Your day.</span><span>All together.</span>', '<span>Every</span><span>rep.</span>')
    .replace('Next workout. Daily macros. Weekly progress.', 'Build your routine.')
    .replace('<div class="display">', '<div class="copy" style="left:1156px"><div class="eyebrow">ONE PLACE FOR BOTH</div><h1><span>Every</span><span>meal.</span></h1><div class="support">Keep your food in focus.</div></div><div class="display">');
  await page.setContent(pair);
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode())); });
  const wide = await page.screenshot();
  for (let i = 0; i < 2; i++) await sharp(wide).extract({ left: i * 1320, top: 0, width: 1320, height: 2868 }).removeAlpha().png().toFile(path.join(splitDir, `0${i + 1}-connected.png`));
  await page.close();
} finally { await browser.close(); }

const thumbs = [];
for (let i = 0; i < panels.length; i++) thumbs.push({ input: await sharp(path.join(OUT, targets[0].key, `${panels[i].file}.png`)).resize({ width: 330 }).toBuffer(), left: i % 4 * 354 + 24, top: Math.floor(i / 4) * 741 + 24 });
await sharp({ create: { width: 1440, height: 1506, channels: 3, background: '#d4d5cc' } }).composite(thumbs).png().toFile(path.join(OUT, 'contact-sheet.png'));
const carousel = await Promise.all(panels.map(async (p, i) => ({ input: await sharp(path.join(OUT, targets[0].key, `${p.file}.png`)).resize({ width: 220 }).toBuffer(), left: i * 228, top: 0 })));
await sharp({ create: { width: 1816, height: 478, channels: 3, background: '#deded7' } }).composite(carousel).png().toFile(path.join(OUT, 'carousel-preview.png'));
const pairThumbs = await Promise.all([1, 2].map(async (n, i) => ({ input: await sharp(path.join(OUT, 'optional-split-pair', `0${n}-connected.png`)).resize({ width: 440 }).toBuffer(), left: i * 452, top: 0 })));
await sharp({ create: { width: 892, height: 956, channels: 3, background: '#e0e0d8' } }).composite(pairThumbs).png().toFile(path.join(OUT, 'split-pair-preview.png'));

const gpThumbs = [];
for (let i = 0; i < panels.length; i++) gpThumbs.push({ input: await sharp(path.join(OUT, 'google-play', `${panels[i].file}.png`)).resize({ width: 330 }).toBuffer(), left: i % 4 * 354 + 24, top: Math.floor(i / 4) * 680 + 24 });
await sharp({ create: { width: 1440, height: 1400, channels: 3, background: '#d4d5cc' } }).composite(gpThumbs).png().toFile(path.join(OUT, 'google-play-contact-sheet.png'));

fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
fs.writeFileSync(path.join(OUT, 'metadata.json'), JSON.stringify(metadata, null, 2) + '\n');
fs.writeFileSync(path.join(OUT, 'preview.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fitzo — App Store & Google Play refresh</title><style>body{margin:0;background:#f3f1e9;color:#171816;font:16px system-ui}header,section{padding:32px max(24px,4vw)}h1{font-size:clamp(34px,5vw,64px);max-width:850px;letter-spacing:-2px}h2{margin-top:24px;font-size:24px}p{max-width:730px;color:#393c33;line-height:1.6}nav{display:flex;gap:16px;flex-wrap:wrap}a{color:#385020}.strip{display:flex;overflow:auto;gap:12px;padding:0 max(24px,4vw) 32px;scroll-snap-type:x mandatory}.strip img{width:clamp(220px,26vw,350px);height:auto;scroll-snap-align:start;border-radius:12px}.pair{display:flex;gap:8px;max-width:880px}.pair img{width:calc(50% - 4px)}small{color:#595b52}</style><header><small>FITZO / PRODUCT PAGE / SEPTEMBER 2026</small><h1>Every rep deserves<br>a better first impression.</h1><p>Eight screenshots on one luminous background. Short headlines, bolder supporting text and a continuous lime ribbon. Available in App Store 6.9", App Store 6.5" and Google Play 1080 × 2160 (2:1 aspect ratio).</p><nav><a href="../en-US.md">Listing copy</a><a href="../README.md">Research & upload notes</a><a href="contact-sheet.png">App Store contact sheet</a><a href="google-play-contact-sheet.png">Google Play contact sheet</a></nav></header><section><h2>App Store (6.9" & 6.5")</h2></section><div class="strip">${panels.map(p => `<a href="app-store-6.9/${p.file}.png"><img src="app-store-6.9/${p.file}.png" alt="${esc(p.title.join(' '))}"></a>`).join('')}</div><section><h2>Google Play (1080 × 2160)</h2></section><div class="strip">${panels.map(p => `<a href="google-play/${p.file}.png"><img src="google-play/${p.file}.png" alt="${esc(p.title.join(' '))}"></a>`).join('')}</div><section><h2>The connected option</h2><p>A single oversized app screen, split across two images. Use these together as an alternative opening pair. The main set above keeps each feature easier to understand when viewed alone.</p><div class="pair"><img alt="Every rep" src="optional-split-pair/01-connected.png"><img alt="Every meal" src="optional-split-pair/02-connected.png"></div></section></html>`);

// Keep canonical store-listing folders updated with the latest artwork
const CANONICAL = path.resolve(HERE, '..');
for (const target of targets) {
  const canonDir = path.join(CANONICAL, target.key);
  fs.mkdirSync(canonDir, { recursive: true });
  for (const f of fs.readdirSync(canonDir)) {
    if (f.endsWith('.png') && !panels.some(p => `${p.file}.png` === f)) {
      fs.unlinkSync(path.join(canonDir, f));
    }
  }
  for (const panel of panels) {
    fs.copyFileSync(
      path.join(OUT, target.key, `${panel.file}.png`),
      path.join(canonDir, `${panel.file}.png`)
    );
  }
}

console.log(`Preview: ${path.join(OUT, 'preview.html')}`);


