#!/usr/bin/env node
/**
 * Draw Fitzo dither subjects procedurally, then dither them.
 *
 * WHY DRAW RATHER THAN GENERATE
 * No image model is reachable from this machine — HeyGen's CLI is not
 * installed, mflux is Apple-Silicon only, codex is not on PATH. These subjects
 * are rotationally symmetric objects, which is the one category you can draw
 * convincingly in code.
 *
 * THE IMPORTANT IDEA: SHADE, DON'T OUTLINE
 * A dither turns a smooth gradient into texture. Feed it flat line art and you
 * get flat line art back with jagged edges; feed it a lit volume and you get
 * the halftone shading that makes the existing assets look like engravings. So
 * everything here is rendered as a lit solid — a Lambert-ish term against a
 * light at upper-left — and the dither supplies the "ink".
 *
 * Anti-aliasing is deliberately 3x supersampled BEFORE the dither. Aliased
 * edges dither into ragged noise that reads as a broken image rather than a
 * texture.
 *
 * Usage:
 *   node scripts/gen-dither-art.js kulhad ../assets/kulhad_dither.png
 *   node scripts/gen-dither-art.js thali  ../assets/thali_dither.png
 *   node scripts/gen-dither-art.js dumbbell ../assets/dumbbell_dither.png
 *   ... add --invert for the black UI, --algo bayer|floyd
 */

const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const [subject, output, ...rest] = process.argv.slice(2);
const has = (f) => rest.includes(`--${f}`);
const val = (f, d) => { const i = rest.indexOf(`--${f}`); return i === -1 ? d : rest[i + 1]; };

const SIZE = parseInt(val('size', 1024), 10);
const SS = 3;                    // supersample factor
const W = SIZE * SS;
const ALGO = val('algo', 'atkinson');
const INVERT = has('invert');

if (!subject || !output) {
    console.error('usage: node scripts/gen-dither-art.js <kulhad|thali|dumbbell|kettlebell> <out.png> [--invert] [--algo atkinson|bayer|floyd] [--size 1024]');
    process.exit(1);
}

// Grayscale canvas, white paper.
const buf = new Float64Array(W * W).fill(255);
const px = (x, y, v) => { if (x >= 0 && y >= 0 && x < W && y < W) buf[y * W + x] = v; };

/** Light direction, normalised, pointing from surface toward the lamp. */
const LX = -0.55, LY = -0.68, LZ = 0.48;

/** Lambert shade for a surface normal, mapped into ink density 0(black)..255(white). */
function shade(nx, ny, nz, ambient = 0.30, gain = 0.78) {
    const d = Math.max(0, nx * LX + ny * LY + nz * LZ);
    const lit = Math.min(1, ambient + gain * d);
    return 255 * (0.06 + 0.94 * lit);   // never pure black: keeps detail in shadow
}

/**
 * A body of revolution seen from the side. `radiusAt(t)` gives the silhouette
 * half-width for t in 0..1 down the object. The surface normal's x component
 * comes from how far across the barrel we are, which is what produces the
 * cylindrical falloff that dithers into curved hatching.
 */
function revolve(cx, top, bottom, radiusAt, opts = {}) {
    const { ambient = 0.3, gain = 0.78 } = opts;
    const h = bottom - top;
    for (let y = Math.floor(top); y < bottom; y++) {
        const t = (y - top) / h;
        const r = radiusAt(t);
        if (r <= 0) continue;
        for (let x = Math.floor(cx - r); x <= cx + r; x++) {
            const u = (x - cx) / r;              // -1..1 across the barrel
            if (u < -1 || u > 1) continue;
            const nz = Math.sqrt(Math.max(0, 1 - u * u));
            px(x, y, shade(u, -0.15, nz, ambient, gain));
        }
    }
}

/** Filled ellipse with a spherical-ish normal — used for rims and knobs. */
function ellipse(cx, cy, rx, ry, opts = {}) {
    const { ambient = 0.32, gain = 0.8, flat = null } = opts;
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
        for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
            const u = (x - cx) / rx, v = (y - cy) / ry;
            const d2 = u * u + v * v;
            if (d2 > 1) continue;
            if (flat !== null) { px(x, y, flat); continue; }
            const nz = Math.sqrt(Math.max(0, 1 - d2));
            px(x, y, shade(u, v, nz, ambient, gain));
        }
    }
}

/** Annulus, for a plate rim. */
function ring(cx, cy, rOuter, rInner, opts = {}) {
    const { ambient = 0.3, gain = 0.8 } = opts;
    for (let y = Math.floor(cy - rOuter); y <= cy + rOuter; y++) {
        for (let x = Math.floor(cx - rOuter); x <= cx + rOuter; x++) {
            const dx = x - cx, dy = y - cy;
            const d = Math.hypot(dx, dy);
            if (d > rOuter || d < rInner) continue;
            // Normal tilts outward across the rim's width.
            const t = (d - rInner) / Math.max(1, rOuter - rInner);   // 0 inner .. 1 outer
            const bend = Math.sin(t * Math.PI);                       // domed
            const nx = (dx / (d || 1)) * (1 - bend) * 0.9;
            const ny = (dy / (d || 1)) * (1 - bend) * 0.9;
            px(x, y, shade(nx, ny, bend, ambient, gain));
        }
    }
}

const S = W / 1024;   // scale helper so subjects are authored at 1024

// --- subjects -----------------------------------------------------------
const SUBJECTS = {
    // Indian clay tea cup: narrow foot, flared lip, thrown-clay bulge.
    kulhad() {
        const cx = W / 2, top = 300 * S, bot = 800 * S;
        revolve(cx, top, bot, (t) => {
            const flare = Math.pow(1 - t, 1.7) * 60 * S;     // widest at the lip
            const belly = Math.sin(t * Math.PI) * 26 * S;     // thrown bulge
            return (150 * S) + flare + belly - t * 46 * S;    // tapers to the foot
        }, { ambient: 0.26, gain: 0.86 });
        // the opening, darker than the body so it reads as a hole
        ellipse(cx, top, 210 * S, 46 * S, { ambient: 0.10, gain: 0.30 });
        // lip highlight sitting on the opening
        ring(cx, top, 210 * S, 178 * S, { ambient: 0.55, gain: 0.9 });
        // foot shadow
        ellipse(cx, bot - 6 * S, 118 * S, 20 * S, { ambient: 0.12, gain: 0.25 });
    },

    // Steel thali seen from slightly above: rim, well, and five katoris.
    thali() {
        const cx = W / 2, cy = W / 2 + 20 * S;
        ring(cx, cy, 430 * S, 348 * S, { ambient: 0.28, gain: 0.9 });      // rim
        ellipse(cx, cy, 350 * S, 336 * S, { ambient: 0.46, gain: 0.42 });   // well
        const bowls = [[-0.52, -0.42], [0.10, -0.60], [0.60, -0.10], [0.34, 0.52], [-0.36, 0.50]];
        for (const [bx, by] of bowls) {
            const x = cx + bx * 300 * S, y = cy + by * 285 * S;
            ellipse(x, y, 96 * S, 90 * S, { ambient: 0.24, gain: 0.9 });    // katori
            ellipse(x, y, 74 * S, 68 * S, { ambient: 0.52, gain: 0.30 });   // its contents
        }
    },

    dumbbell() {
        const cy = W / 2;
        // bar
        for (let y = cy - 34 * S; y <= cy + 34 * S; y++) {
            const u = (y - cy) / (34 * S);
            const nz = Math.sqrt(Math.max(0, 1 - u * u));
            for (let x = 300 * S; x <= 724 * S; x++) px(x, y, shade(0.1, u, nz, 0.3, 0.85));
        }
        for (const dir of [-1, 1]) {
            const bx = W / 2 + dir * 300 * S;
            revolve(bx, cy - 150 * S, cy + 150 * S, (t) => {
                const waist = Math.sin(t * Math.PI);
                return 92 * S + waist * 26 * S;
            }, { ambient: 0.24, gain: 0.9 });
        }
    },

    kettlebell() {
        const cx = W / 2, cy = W / 2 + 90 * S;
        ellipse(cx, cy, 260 * S, 250 * S, { ambient: 0.22, gain: 0.92 });     // bell
        // handle: two uprights and a crown
        revolve(cx - 168 * S, cy - 330 * S, cy - 90 * S, () => 40 * S, { ambient: 0.26, gain: 0.88 });
        revolve(cx + 168 * S, cy - 330 * S, cy - 90 * S, () => 40 * S, { ambient: 0.26, gain: 0.88 });
        ring(cx, cy - 320 * S, 208 * S, 128 * S, { ambient: 0.26, gain: 0.9 });
        ellipse(cx, cy + 30 * S, 150 * S, 120 * S, { ambient: 0.62, gain: 0.25 }); // flat face for a number
    },
};

if (!SUBJECTS[subject]) {
    console.error(`unknown subject "${subject}". available: ${Object.keys(SUBJECTS).join(', ')}`);
    process.exit(1);
}
SUBJECTS[subject]();

// --- downsample (this is the anti-aliasing) -----------------------------
const gray = new Float64Array(SIZE * SIZE);
for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
        let s = 0;
        for (let dy = 0; dy < SS; dy++) for (let dx = 0; dx < SS; dx++) s += buf[(y * SS + dy) * W + (x * SS + dx)];
        gray[y * SIZE + x] = s / (SS * SS);
    }
}

// --- dither (same kernels as make-dither.js) ----------------------------
const BAYER8 = [
    [0, 32, 8, 40, 2, 34, 10, 42], [48, 16, 56, 24, 50, 18, 58, 26],
    [12, 44, 4, 36, 14, 46, 6, 38], [60, 28, 52, 20, 62, 30, 54, 22],
    [3, 35, 11, 43, 1, 33, 9, 41], [51, 19, 59, 27, 49, 17, 57, 25],
    [15, 47, 7, 39, 13, 45, 5, 37], [63, 31, 55, 23, 61, 29, 53, 21]];
const ATKINSON = [[1, 0, 1], [2, 0, 1], [-1, 1, 1], [0, 1, 1], [1, 1, 1], [0, 2, 1]];
const FLOYD = [[1, 0, 7], [-1, 1, 3], [0, 1, 5], [1, 1, 1]];

function diffuse(g, size, kernel, divisor) {
    const b = Float64Array.from(g), out = new Uint8Array(size * size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const i = y * size + x, old = b[i], nv = old > 128 ? 255 : 0;
        out[i] = nv; const err = old - nv;
        for (const [dx, dy, w] of kernel) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= size || ny >= size) continue;
            b[ny * size + nx] += err * w / divisor;
        }
    }
    return out;
}

let bits;
if (ALGO === 'bayer') {
    bits = new Uint8Array(SIZE * SIZE);
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++)
        bits[y * SIZE + x] = gray[y * SIZE + x] > (BAYER8[y & 7][x & 7] + 0.5) / 64 * 255 ? 255 : 0;
} else if (ALGO === 'floyd') bits = diffuse(gray, SIZE, FLOYD, 16);
else bits = diffuse(gray, SIZE, ATKINSON, 8);

if (INVERT) for (let i = 0; i < bits.length; i++) bits[i] = 255 - bits[i];

const png = new PNG({ width: SIZE, height: SIZE });
for (let i = 0; i < bits.length; i++) {
    const v = bits[i], o = i << 2;
    png.data[o] = v; png.data[o + 1] = v; png.data[o + 2] = v; png.data[o + 3] = 255;
}
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, PNG.sync.write(png));

const ink = bits.reduce((n, v) => n + (v === 0 ? 1 : 0), 0);
console.log(`${path.basename(output)}  ${subject}  ${SIZE}x${SIZE}  algo=${ALGO}${INVERT ? ' inverted' : ''}  ink ${(ink / bits.length * 100).toFixed(1)}%`);
