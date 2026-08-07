/**
 * Cross-checks seed_learn_v2.js against the approved markdown drafts.
 *
 * The seed's own validation proves `correct` points at the answer STRING that
 * was typed. It cannot prove that string is the option the draft marked with a
 * tick. Transcribing the wrong option produces a lesson that confidently marks
 * the wrong answer right, and every other check passes.
 *
 * So: parse (question -> ticked answer) out of the drafts and compare.
 *
 * Draft shape:
 *   **Q1.** Question text?
 *   - Option A
 *   - **Option B** ✓
 *   ...
 */

const fs = require('fs');
const path = require('path');

const DOCS = path.join(__dirname, '..', '..', 'docs');
const FILES = [
    'learn-content-draft-sample.md',
    'learn-content-draft-rewrites.md',
    'learn-content-draft-new.md',
];

const norm = (s) => s
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[‘’]/g, "'")
    .replace(/ /g, ' ')
    .trim();

function parseDrafts() {
    const map = new Map(); // normalised question -> normalised answer
    for (const file of FILES) {
        const lines = fs.readFileSync(path.join(DOCS, file), 'utf8').split('\n');
        let current = null;
        let answer = null;
        for (const line of lines) {
            const qm = line.match(/^\*\*(?:[A-Za-z]+ )?Q\d+\.\*\*\s*(.+)$/);
            if (qm) {
                if (current && answer) map.set(current, answer);
                current = norm(qm[1]);
                answer = null;
                continue;
            }
            const om = line.match(/^-\s*(.+?)\s*✓\s*$/);
            if (om && current) answer = norm(om[1]);
        }
        if (current && answer) map.set(current, answer);
    }
    return map;
}

function loadSeed() {
    const src = fs.readFileSync(path.join(__dirname, 'seed_learn_v2.js'), 'utf8');
    // Pull the four exported arrays out by evaluating the module in a sandbox
    // that stubs the database bits away.
    const mod = { exports: {} };
    const stub = new Function('require', 'module', 'process', `
        ${src.replace(/^main\(\);\s*$/m, '')}
        module.exports = { REWRITE, APPEND, QUESTIONS_ONLY, NEW };
    `);
    stub(
        (name) => (name === 'pg' ? { Client: function () {} } : { config: () => {} }),
        mod,
        { argv: [], exit: () => {}, env: {} }
    );
    return mod.exports;
}

const drafts = parseDrafts();
const { REWRITE, APPEND, QUESTIONS_ONLY, NEW } = loadSeed();

let checked = 0;
let notFound = [];
let mismatched = [];

for (const group of [REWRITE, APPEND, QUESTIONS_ONLY, NEW]) {
    for (const lesson of group) {
        for (const q of lesson.questions) {
            const key = norm(q.q);
            if (!drafts.has(key)) {
                notFound.push(`${lesson.title}: ${q.q}`);
                continue;
            }
            checked++;
            const draftAnswer = drafts.get(key);
            if (draftAnswer !== norm(q.answer)) {
                mismatched.push(
                    `${lesson.title}\n    question: ${q.q}\n    draft:  ${draftAnswer}\n    seed:   ${norm(q.answer)}`
                );
            }
        }
    }
}

console.log(`Parsed ${drafts.size} questions from drafts.`);
console.log(`Cross-checked ${checked} seed questions against them.`);

if (notFound.length) {
    console.log(`\n${notFound.length} seed question(s) had no draft match (wording drift, review manually):`);
    notFound.forEach((n) => console.log(`  - ${n}`));
}

if (mismatched.length) {
    console.log(`\nANSWER MISMATCH in ${mismatched.length} question(s):`);
    mismatched.forEach((m) => console.log(`  - ${m}`));
    process.exit(1);
}

console.log('\nNo answer mismatches.');
if (notFound.length) process.exit(2);
