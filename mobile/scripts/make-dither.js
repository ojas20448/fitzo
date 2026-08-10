#!/usr/bin/env node
/**
 * Turn any image into a Fitzo 1-bit dither asset.
 *
 * WHY THIS EXISTS
 * The four shipped assets (barbell, elephant, rickshaw, trophy) are a real
 * brand texture, but there was no way to make a fifth that matched. Sourcing
 * one-off art and eyeballing the treatment gives you four things that look
 * similar and a fifth that looks off. This makes the treatment reproducible:
 * bring any source image — a photo, generated art, a render — and get an asset
 * in the same register.
 *
 * WORTH KNOWING ABOUT THE ORIGINALS
 * They are not truly 1-bit. Measured: 256 distinct grey values, dominated by
 * 255 (36%) and 0 (15%) with 254/1 close behind — the signature of a dithered
 * image that was rescaled afterwards, which smears the edges. This script
 * dithers AFTER resampling, so its output is genuinely two-tone and slightly
 * crisper than what ships today. That is a deliberate improvement, not a
 * mismatch; at 8-15% opacity behind type nobody will see the difference, and
 * at full size the new ones look better.
 *
 * Usage
 *   node scripts/make-dither.js <input.png> <output.png> [options]
 *
 *   --algo atkinson|bayer|floyd   default atkinson
 *   --size 1024                   output square size
 *   --contrast 1.0                pre-dither contrast, >1 crushes mid-tones
 *   --brightness 0                -255..255, added before dithering
 *   --invert                      white art on black, for the dark UI
 *   --threshold 128               bayer/floyd cut point
 *
 * Examples
 *   node scripts/make-dither.js in.png ../assets/kettlebell_dither.png
 *   node scripts/make-dither.js in.png out.png --algo bayer --invert --contrast 1.3
 */

const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

// --- args ---------------------------------------------------------------
const argv = process.argv.slice(2);
const flag = (name, def) => {
    const i = argv.indexOf(`--${name}`);
    if (i === -1) return def;
    const v = argv[i + 1];
    return v && !v.startsWith('--') ? v : true;
};
const [input, output] = argv.filter(a => !a.startsWith('--') && argv[argv.indexOf(a) - 1]?.startsWith('--') !== true);

if (!input || !output) {
    console.error('usage: node scripts/make-dither.js <input.png> <output.png> [--algo atkinson|bayer|floyd] [--size 1024] [--contrast 1.0] [--brightness 0] [--invert] [--threshold 128]');
    process.exit(1);
}

const ALGO = String(flag('algo', 'atkinson'));
const SIZE = parseInt(flag('size', 1024), 10);
const CONTRAST = parseFloat(flag('contrast', 1));
const BRIGHTNESS = parseFloat(flag('brightness', 0));
const INVERT = flag('invert', false) === true;
const THRESHOLD = parseFloat(flag('threshold', 128));

// --- load + grayscale ---------------------------------------------------
const src = PNG.sync.read(fs.readFileSync(input));

/** Rec. 709 luma — matches how the eye weights the channels. */
function luma(r, g, b) {
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Box-filter resample to a square.
 *
 * Averaging every source pixel that lands in a destination cell, rather than
 * point-sampling, is what keeps fine detail (an elephant's ear, a rickshaw's
 * spokes) from breaking into noise once it is dithered. Nearest-neighbour here
 * produces speckle that reads as a compression artefact.
 */
function resampleToSquare(png, size) {
    const out = new Float64Array(size * size);
    const sx = png.width / size;
    const sy = png.height / size;
    for (let y = 0; y < size; y++) {
        const y0 = Math.floor(y * sy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
        for (let x = 0; x < size; x++) {
            const x0 = Math.floor(x * sx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx));
            let sum = 0, n = 0;
            for (let yy = y0; yy < y1 && yy < png.height; yy++) {
                for (let xx = x0; xx < x1 && xx < png.width; xx++) {
                    const i = (yy * png.width + xx) << 2;
                    const a = png.data[i + 3] / 255;
                    // Composite onto WHITE. Transparent source corners must not
                    // become black blobs — every one of these illustrations is
                    // ink on paper.
                    const r = png.data[i] * a + 255 * (1 - a);
                    const g = png.data[i + 1] * a + 255 * (1 - a);
                    const b = png.data[i + 2] * a + 255 * (1 - a);
                    sum += luma(r, g, b); n++;
                }
            }
            out[y * size + x] = n ? sum / n : 255;
        }
    }
    return out;
}

const gray = resampleToSquare(src, SIZE);

// --- levels -------------------------------------------------------------
for (let i = 0; i < gray.length; i++) {
    let v = gray[i] + BRIGHTNESS;
    v = (v - 128) * CONTRAST + 128;
    gray[i] = Math.min(255, Math.max(0, v));
}

// --- dithering ----------------------------------------------------------
const BAYER8 = [
    [0, 32, 8, 40, 2, 34, 10, 42], [48, 16, 56, 24, 50, 18, 58, 26],
    [12, 44, 4, 36, 14, 46, 6, 38], [60, 28, 52, 20, 62, 30, 54, 22],
    [3, 35, 11, 43, 1, 33, 9, 41], [51, 19, 59, 27, 49, 17, 57, 25],
    [15, 47, 7, 39, 13, 45, 5, 37], [63, 31, 55, 23, 61, 29, 53, 21],
];

function ditherBayer(g, size) {
    const out = new Uint8Array(size * size);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const t = (BAYER8[y & 7][x & 7] + 0.5) / 64 * 255;
            out[y * size + x] = g[y * size + x] > t ? 255 : 0;
        }
    }
    return out;
}

/**
 * Error diffusion. Atkinson pushes only 3/4 of the error, which is exactly why
 * the classic Mac look has open, clean highlights instead of grey mush — it is
 * the better match for line art on white. Floyd-Steinberg conserves all error
 * and holds photographic mid-tones better.
 */
function ditherDiffuse(g, size, kernel, divisor) {
    const buf = Float64Array.from(g);
    const out = new Uint8Array(size * size);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const i = y * size + x;
            const old = buf[i];
            const nv = old > THRESHOLD ? 255 : 0;
            out[i] = nv;
            const err = old - nv;
            for (const [dx, dy, w] of kernel) {
                const nx = x + dx, ny = y + dy;
                if (nx < 0 || nx >= size || ny >= size) continue;
                buf[ny * size + nx] += err * w / divisor;
            }
        }
    }
    return out;
}

const ATKINSON = [[1, 0, 1], [2, 0, 1], [-1, 1, 1], [0, 1, 1], [1, 1, 1], [0, 2, 1]];
const FLOYD = [[1, 0, 7], [-1, 1, 3], [0, 1, 5], [1, 1, 1]];

let bits;
if (ALGO === 'bayer') bits = ditherBayer(gray, SIZE);
else if (ALGO === 'floyd') bits = ditherDiffuse(gray, SIZE, FLOYD, 16);
else bits = ditherDiffuse(gray, SIZE, ATKINSON, 8);

if (INVERT) for (let i = 0; i < bits.length; i++) bits[i] = 255 - bits[i];

// --- write --------------------------------------------------------------
const png = new PNG({ width: SIZE, height: SIZE });
for (let i = 0; i < bits.length; i++) {
    const v = bits[i], o = i << 2;
    png.data[o] = v; png.data[o + 1] = v; png.data[o + 2] = v; png.data[o + 3] = 255;
}
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, PNG.sync.write(png));

const black = bits.reduce((n, v) => n + (v === 0 ? 1 : 0), 0);
console.log(`${path.basename(output)}  ${SIZE}x${SIZE}  algo=${ALGO}${INVERT ? ' inverted' : ''}`);
console.log(`  ink coverage: ${(black / bits.length * 100).toFixed(1)}%   tones: 2 (true 1-bit)`);
