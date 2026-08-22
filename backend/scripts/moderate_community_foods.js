#!/usr/bin/env node
/**
 * Community food catalog — moderation CLI.
 *
 * The catalog is auto-publish: a member's submission is live in global search
 * the moment it is accepted, and three distinct flags auto-hide it. There is no
 * in-app reviewer, so this script IS the moderation surface. Nothing else can
 * restore a wrongly-flagged food, kill a spam entry outright, or graduate a
 * proven community food into the curated indian-foods.json.
 *
 * Run it against whatever DATABASE_URL points at — check that first.
 *
 *   node scripts/moderate_community_foods.js --review
 *       Foods auto-hidden by flags, newest first, with every flag reason.
 *       Start here.
 *
 *   node scripts/moderate_community_foods.js --list [--status live|hidden|removed]
 *       Browse the catalog. Defaults to live.
 *
 *   node scripts/moderate_community_foods.js --recent [--days 7]
 *       Everything submitted lately. The routine spot-check — auto-publish
 *       means nobody has looked at these.
 *
 *   node scripts/moderate_community_foods.js --restore <id>
 *       Un-hide a food and clear its flags. For entries that were correct and
 *       got brigaded, or flagged for a reason you have since fixed.
 *
 *   node scripts/moderate_community_foods.js --hide <id>
 *       Pull a food from search without waiting for three flags.
 *
 *   node scripts/moderate_community_foods.js --remove <id>
 *       Tombstone. Irreversible through this tool. calorie_logs rows survive
 *       via ON DELETE SET NULL — members keep their history.
 *
 *   node scripts/moderate_community_foods.js --edit <id> --calories 210 --protein 12
 *       Correct the numbers in place. Also clears flags, on the assumption
 *       that wrong macros were what people were flagging.
 *
 *   node scripts/moderate_community_foods.js --promote <id>
 *       Graduate into src/data/indian-foods.json — the curated file — and
 *       tombstone the community row so the two can never diverge. This is the
 *       endgame for a food that has proven itself. Commit and redeploy after.
 *
 *   node scripts/moderate_community_foods.js --promotable [--min-logs 25]
 *       Rank community foods by real usage to find --promote candidates.
 *
 * Add --yes to skip the confirmation prompt on write actions.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { Client } = require('pg');

const CURATED = path.join(__dirname, '..', 'src', 'data', 'indian-foods.json');

// ---------------------------------------------------------------- arg parsing
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d = null) => {
    const i = argv.indexOf(f);
    return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};

if (!argv.length || has('--help') || has('-h')) {
    console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^#!.*\n/, ''));
    process.exit(0);
}

// Accept the API's prefixed form as well as a bare uuid, so an id copied
// straight out of a search response or a bug report just works.
const unprefix = (id) => (id && id.startsWith('com_') ? id.slice(4) : id);

const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;

function confirm(question) {
    if (has('--yes')) return Promise.resolve(true);
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
        rl.question(`${question} [y/N] `, (a) => {
            rl.close();
            resolve(/^y(es)?$/i.test(a.trim()));
        });
    });
}

function printFood(f, i = null) {
    const n = i === null ? '' : dim(`${String(i + 1).padStart(3)}. `);
    const status =
        f.status === 'live' ? green('live') : f.status === 'hidden' ? yellow('hidden') : red('removed');
    console.log(`${n}${bold(f.name)}  ${dim(`[${status}]`)}`);
    console.log(
        dim(
            `     ${f.calories} kcal · P${f.protein} C${f.carbs} F${f.fat} · ${f.serving_size} · ${f.category}`
        )
    );
    console.log(
        dim(
            `     flags ${f.flag_count} · logged ${f.log_count}× · by @${f.submitter_username || 'deleted user'} · ${new Date(f.created_at).toISOString().slice(0, 10)}`
        )
    );
    console.log(dim(`     com_${f.id}`));
}

const SELECT = `
    SELECT cf.*, u.username AS submitter_username
      FROM community_foods cf
      LEFT JOIN users u ON u.id = cf.submitted_by`;

// ------------------------------------------------------------------- actions
async function review(c) {
    const { rows } = await c.query(
        `${SELECT} WHERE cf.status = 'hidden' ORDER BY cf.updated_at DESC LIMIT 50`
    );
    if (!rows.length) return console.log(green('\nNothing auto-hidden. Catalog is clean.\n'));

    console.log(bold(`\n${rows.length} food(s) auto-hidden by flags:\n`));
    for (const [i, f] of rows.entries()) {
        printFood(f, i);
        const { rows: flags } = await c.query(
            `SELECT ff.reason, ff.note, u.username
               FROM community_food_flags ff
               LEFT JOIN users u ON u.id = ff.user_id
              WHERE ff.food_id = $1 ORDER BY ff.created_at`,
            [f.id]
        );
        for (const fl of flags) {
            console.log(dim(`       ↳ ${fl.reason}${fl.note ? `: "${fl.note}"` : ''} — @${fl.username || '?'}`));
        }
        console.log();
    }
    console.log(dim('  --restore <id> to put one back · --remove <id> to kill it\n'));
}

async function list(c) {
    const status = val('--status', 'live');
    const { rows } = await c.query(
        `${SELECT} WHERE cf.status = $1 ORDER BY cf.log_count DESC, cf.created_at DESC LIMIT 100`,
        [status]
    );
    console.log(bold(`\n${rows.length} ${status} food(s):\n`));
    rows.forEach((f, i) => (printFood(f, i), console.log()));
}

async function recent(c) {
    const days = parseInt(val('--days', '7'), 10);
    const { rows } = await c.query(
        `${SELECT} WHERE cf.created_at > NOW() - ($1 || ' days')::interval
                     AND cf.status <> 'removed'
          ORDER BY cf.created_at DESC LIMIT 100`,
        [String(days)]
    );
    console.log(bold(`\n${rows.length} food(s) added in the last ${days} day(s):\n`));
    rows.forEach((f, i) => (printFood(f, i), console.log()));
    if (rows.length) console.log(dim('  Nobody reviewed these before they went live. Spot-check the macros.\n'));
}

async function promotable(c) {
    const min = parseInt(val('--min-logs', '25'), 10);
    const { rows } = await c.query(
        `${SELECT} WHERE cf.status = 'live' AND cf.log_count >= $1 AND cf.flag_count = 0
          ORDER BY cf.log_count DESC LIMIT 50`,
        [min]
    );
    if (!rows.length) return console.log(dim(`\nNothing logged ${min}+ times yet.\n`));
    console.log(bold(`\n${rows.length} food(s) earning a place in the curated catalog:\n`));
    rows.forEach((f, i) => (printFood(f, i), console.log()));
    console.log(dim('  --promote <id> to move one into indian-foods.json\n'));
}

async function setStatus(c, id, status, { clearFlags = false } = {}) {
    const { rows } = await c.query(`${SELECT} WHERE cf.id = $1`, [id]);
    if (!rows.length) return console.log(red('No food with that id.'));
    printFood(rows[0]);
    if (!(await confirm(`\n${bold(status.toUpperCase())} this food?`))) return console.log(dim('Aborted.'));

    if (clearFlags) await c.query('DELETE FROM community_food_flags WHERE food_id = $1', [id]);
    await c.query(
        `UPDATE community_foods
            SET status = $2, flag_count = $3, updated_at = NOW()
          WHERE id = $1`,
        [id, status, clearFlags ? 0 : rows[0].flag_count]
    );
    console.log(green(`\n✅ now ${status}${clearFlags ? ', flags cleared' : ''}.\n`));
}

async function edit(c, id) {
    const fields = ['calories', 'protein', 'carbs', 'fat', 'fiber', 'serving_size', 'category', 'name'];
    const updates = {};
    for (const f of fields) {
        const v = val(`--${f}`);
        if (v !== null) updates[f] = ['serving_size', 'category', 'name'].includes(f) ? v : Number(v);
    }
    if (!Object.keys(updates).length) return console.log(red('Nothing to change. Pass e.g. --calories 210'));

    const { rows } = await c.query(`${SELECT} WHERE cf.id = $1`, [id]);
    if (!rows.length) return console.log(red('No food with that id.'));

    console.log(dim('\nbefore:'));
    printFood(rows[0]);
    console.log(bold('\nchanges:'));
    for (const [k, v] of Object.entries(updates)) console.log(`     ${k}: ${rows[0][k]} → ${green(v)}`);
    if (!(await confirm('\nApply?'))) return console.log(dim('Aborted.'));

    const sets = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`).join(', ');
    await c.query(
        `UPDATE community_foods SET ${sets}, flag_count = 0, status = 'live', updated_at = NOW() WHERE id = $1`,
        [id, ...Object.values(updates)]
    );
    // The flags were almost certainly about the numbers just corrected.
    await c.query('DELETE FROM community_food_flags WHERE food_id = $1', [id]);
    console.log(green('\n✅ updated, flags cleared, back in search.\n'));
}

async function promote(c, id) {
    const { rows } = await c.query(`${SELECT} WHERE cf.id = $1 AND cf.status = 'live'`, [id]);
    if (!rows.length) return console.log(red('No live food with that id.'));
    const f = rows[0];
    printFood(f);

    const curated = JSON.parse(fs.readFileSync(CURATED, 'utf8'));
    const clash = curated.find((x) => x.name.toLowerCase() === f.name.toLowerCase());
    if (clash) return console.log(red(`\n"${clash.name}" (${clash.id}) is already curated. Use --remove instead.\n`));

    // ids are ind_<n>; continue the sequence rather than reusing a gap, so an
    // id that leaked into a client's cache can never point at a different food.
    const maxN = curated.reduce((m, x) => {
        const n = parseInt(String(x.id).replace('ind_', ''), 10);
        return Number.isFinite(n) && n > m ? n : m;
    }, 0);

    const entry = {
        id: `ind_${maxN + 1}`,
        name: f.name,
        category: f.category,
        servingSize: f.serving_size,
        calories: Number(f.calories),
        protein: Number(f.protein),
        carbs: Number(f.carbs),
        fat: Number(f.fat),
        fiber: Number(f.fiber),
        region: f.region,
    };

    console.log(bold('\nwill append to indian-foods.json:'));
    console.log(dim(JSON.stringify(entry, null, 2).split('\n').map((l) => '     ' + l).join('\n')));
    console.log(dim(`\n     and tombstone com_${f.id} so the two cannot diverge.`));
    if (!(await confirm('\nPromote?'))) return console.log(dim('Aborted.'));

    curated.push(entry);
    fs.writeFileSync(CURATED, JSON.stringify(curated, null, 2));
    await c.query(`UPDATE community_foods SET status = 'removed', updated_at = NOW() WHERE id = $1`, [id]);

    console.log(green(`\n✅ promoted as ${entry.id}. Catalog is now ${curated.length} foods.`));
    console.log(yellow('   The JSON is baked into the image — commit and redeploy for this to go live.\n'));
}

// ---------------------------------------------------------------------- main
(async () => {
    const c = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
    });
    await c.connect();
    try {
        const host = new URL(process.env.DATABASE_URL).hostname;
        console.log(dim(`\ndb: ${host}`));

        if (has('--review')) return await review(c);
        if (has('--list')) return await list(c);
        if (has('--recent')) return await recent(c);
        if (has('--promotable')) return await promotable(c);

        const restore = val('--restore');
        if (restore) return await setStatus(c, unprefix(restore), 'live', { clearFlags: true });

        const hide = val('--hide');
        if (hide) return await setStatus(c, unprefix(hide), 'hidden');

        const remove = val('--remove');
        if (remove) return await setStatus(c, unprefix(remove), 'removed');

        const ed = val('--edit');
        if (ed) return await edit(c, unprefix(ed));

        const pr = val('--promote');
        if (pr) return await promote(c, unprefix(pr));

        console.log(red('Unknown action. --help for usage.'));
    } catch (e) {
        console.error(red(`\n${e.message}\n`));
        process.exitCode = 1;
    } finally {
        await c.end();
    }
})();
