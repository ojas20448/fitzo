/**
 * Mobile ↔ Backend Wiring Audit
 *
 * 1. Every router.push/replace target in mobile must match a route in mobile/app/
 * 2. Every api.<method>('path') call in api.ts must match a mounted backend route
 *
 * Usage: node scripts/wiring_audit.js   (from backend/)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const MOBILE = path.join(ROOT, 'mobile');
const BACKEND_ROUTES = path.join(ROOT, 'backend', 'src', 'routes');

// ---------- helpers ----------
function walk(dir, exts, files = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, exts, files);
        else if (exts.some(e => entry.name.endsWith(e))) files.push(full);
    }
    return files;
}

// ---------- 1. Expo router routes from mobile/app ----------
function expoRoutes() {
    const appDir = path.join(MOBILE, 'app');
    const routes = new Set();
    for (const file of walk(appDir, ['.tsx'])) {
        let rel = path.relative(appDir, file).replace(/\\/g, '/');
        if (rel.endsWith('_layout.tsx')) continue;
        rel = rel.replace(/\.tsx$/, '');
        // strip group segments like (tabs)
        rel = rel.split('/').filter(seg => !seg.startsWith('(')).join('/');
        if (rel.endsWith('index')) rel = rel.replace(/\/?index$/, '');
        const route = '/' + rel;
        routes.add(route === '/' ? '/' : route.replace(/\/$/, ''));
    }
    return routes;
}

function routeMatches(target, routes) {
    // strip query + group segments (expo-router allows navigating with group names, e.g. /(tabs)/learn)
    let clean = target.split('?')[0].replace(/\/$/, '') || '/';
    clean = '/' + clean.split('/').filter(seg => seg && !seg.startsWith('(')).join('/');
    if (clean === '/') return routes.has('/');
    if (routes.has(clean)) return true;
    // dynamic segments: match [id] patterns
    for (const r of routes) {
        if (!r.includes('[')) continue;
        const pattern = '^' + r.replace(/\[[^\]]+\]/g, '[^/]+').replace(/\//g, '\\/') + '$';
        if (new RegExp(pattern).test(clean)) return true;
    }
    return false;
}

// ---------- 2. Extract router.push targets ----------
function pushTargets() {
    const targets = new Map(); // target -> [files]
    const files = walk(path.join(MOBILE, 'src'), ['.tsx', '.ts'])
        .concat(walk(path.join(MOBILE, 'app'), ['.tsx']));
    const re = /router\.(?:push|replace|navigate)\(\s*[`'"]([^`'"]+)[`'"]/g;
    for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        let m;
        while ((m = re.exec(content)) !== null) {
            let t = m[1];
            // template params ${...} → [param]
            t = t.replace(/\$\{[^}]+\}/g, '[param]');
            if (!t.startsWith('/')) continue; // relative/back nav
            const key = t;
            if (!targets.has(key)) targets.set(key, []);
            targets.get(key).push(path.relative(MOBILE, file).replace(/\\/g, '/'));
        }
    }
    return targets;
}

// ---------- 3. Backend route table ----------
function backendRoutes() {
    // mounts from index.js
    const indexSrc = fs.readFileSync(path.join(ROOT, 'backend', 'src', 'index.js'), 'utf8');
    const mounts = {}; // file -> prefix
    const mountRe = /app\.use\('([^']+)',\s*require\('\.\/routes\/([^']+)'\)\)/g;
    let m;
    while ((m = mountRe.exec(indexSrc)) !== null) mounts[m[2]] = m[1];

    const table = []; // {method, full}
    for (const [file, prefix] of Object.entries(mounts)) {
        const src = fs.readFileSync(path.join(BACKEND_ROUTES, `${file}.js`), 'utf8');
        const rre = /router\.(get|post|put|patch|delete)\(\s*'([^']*)'/g;
        let r;
        while ((r = rre.exec(src)) !== null) {
            const sub = r[2] === '/' ? '' : r[2];
            table.push({ method: r[1].toUpperCase(), full: (prefix + sub).replace(/\/$/, '') || prefix });
        }
    }
    return table;
}

function apiCalls() {
    const src = fs.readFileSync(path.join(MOBILE, 'src', 'services', 'api.ts'), 'utf8');
    const calls = []; // {method, path, line}
    const re = /api\.(get|post|put|patch|delete)(?:<[^>]*>)?\(\s*[`'"]([^`'"]+)[`'"]/g;
    let m;
    const lines = src.split('\n');
    while ((m = re.exec(src)) !== null) {
        let p = m[2].split('?')[0];
        p = p.replace(/\$\{[^}]+\}/g, ':param');
        const line = src.slice(0, m.index).split('\n').length;
        calls.push({ method: m[1].toUpperCase(), path: p, line });
    }
    return calls;
}

function backendMatches(call, table) {
    const full = ('/api' + call.path).replace(/\/$/, '');
    for (const r of table) {
        if (r.method !== call.method) continue;
        const pattern = '^' + r.full.replace(/:[^/]+/g, '[^/]+').replace(/\//g, '\\/') + '$';
        const callPattern = full.replace(/:param/g, 'XXXX');
        if (new RegExp(pattern).test(callPattern)) return true;
    }
    return false;
}

// ---------- run ----------
const routes = expoRoutes();
const targets = pushTargets();
console.log(`\n===== 1. NAVIGATION: ${targets.size} distinct push targets vs ${routes.size} routes =====`);
let navFails = 0;
for (const [t, files] of [...targets.entries()].sort()) {
    if (!routeMatches(t, routes)) {
        navFails++;
        console.log(`  ❌ ${t}  ← ${files[0]}${files.length > 1 ? ` (+${files.length - 1} more)` : ''}`);
    }
}
if (!navFails) console.log('  ✅ every navigation target resolves to a screen');

const table = backendRoutes();
const calls = apiCalls();
console.log(`\n===== 2. API: ${calls.length} api.ts calls vs ${table.length} backend routes =====`);
let apiFails = 0;
for (const c of calls) {
    if (!backendMatches(c, table)) {
        apiFails++;
        console.log(`  ❌ ${c.method} /api${c.path}  (api.ts:${c.line})`);
    }
}
if (!apiFails) console.log('  ✅ every api.ts call maps to a real backend route');

console.log(`\nSummary: nav orphans=${navFails}, api orphans=${apiFails}`);
