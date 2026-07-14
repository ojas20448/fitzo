/**
 * Gym Pilot Onboarding Script
 *
 * Creates a gym + its manager account in one shot, and generates a
 * printable QR check-in poster (HTML) for the front desk.
 *
 * Usage:
 *   node scripts/create_gym.js --name "Iron Paradise Gym" --manager-email owner@gym.com [--manager-name "Owner Name"] [--password secret123]
 *
 * Output:
 *   - Gym row in DB with unique check-in code
 *   - Manager user (role: manager) linked to the gym
 *   - scripts/output/poster-<slug>.html  → open in a browser, Ctrl+P, print, tape to front desk
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { pool, query } = require('../src/config/database');

function parseArgs(argv) {
    const args = {};
    for (let i = 2; i < argv.length; i++) {
        if (argv[i].startsWith('--')) {
            const key = argv[i].slice(2);
            const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
            args[key] = value;
        }
    }
    return args;
}

function slugify(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function buildPosterHtml({ gymName, gymId }) {
    const qrPayload = JSON.stringify({ gym_id: gymId });
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${gymName} — Fitzo Check-in</title>
<style>
  @page { size: A4 portrait; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Roboto, Arial, sans-serif; background: #000; color: #fff;
         width: 210mm; min-height: 297mm; display: flex; flex-direction: column;
         align-items: center; justify-content: center; gap: 28px; padding: 40px; }
  .brand { font-size: 28px; letter-spacing: 10px; font-weight: 300; }
  h1 { font-size: 40px; font-weight: 700; text-align: center; }
  .sub { font-size: 20px; color: #bbb; text-align: center; }
  .qr-wrap { background: #fff; padding: 28px; border-radius: 24px; }
  ol { font-size: 18px; color: #ddd; line-height: 2; list-style-position: inside; text-align: left; }
  .gym { font-size: 16px; color: #888; letter-spacing: 2px; text-transform: uppercase; }
</style>
</head>
<body>
  <div class="brand">F I T Z O</div>
  <h1>Scan to check in 💪</h1>
  <p class="sub">Track your streak. See who else is training. It's free.</p>
  <div class="qr-wrap"><div id="qrcode"></div></div>
  <ol>
    <li>Download <strong>Fitzo</strong> on your phone</li>
    <li>Sign up &amp; tap the QR button on the home screen</li>
    <li>Scan this code — that's it, you're checked in</li>
  </ol>
  <div class="gym">${gymName}</div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
  <script>
    new QRCode(document.getElementById('qrcode'), {
      text: ${JSON.stringify(qrPayload)},
      width: 380,
      height: 380,
      correctLevel: QRCode.CorrectLevel.M
    });
  </script>
</body>
</html>`;
}

async function main() {
    const args = parseArgs(process.argv);

    const gymName = args.name;
    const managerEmail = (args['manager-email'] || '').toLowerCase().trim();
    const managerName = args['manager-name'] || 'Gym Manager';
    const password = args.password || crypto.randomBytes(6).toString('base64url');
    const capacity = parseInt(args.capacity, 10) || 50;

    if (!gymName || !managerEmail) {
        console.error('Usage: node scripts/create_gym.js --name "Gym Name" --manager-email owner@gym.com [--manager-name "Owner"] [--password secret] [--capacity 50]');
        process.exit(1);
    }

    // Refuse duplicate manager email
    const existing = await query('SELECT id FROM users WHERE email = $1', [managerEmail]);
    if (existing.rows.length > 0) {
        console.error(`❌ A user with email ${managerEmail} already exists. Pick another email.`);
        process.exit(1);
    }

    const qrCode = `FITZO-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    const client = await pool.connect();
    let gym, manager;
    try {
        await client.query('BEGIN');

        const gymResult = await client.query(
            `INSERT INTO gyms (name, qr_code, capacity) VALUES ($1, $2, $3) RETURNING id, name, qr_code, capacity`,
            [gymName, qrCode, capacity]
        );
        gym = gymResult.rows[0];

        const passwordHash = await bcrypt.hash(password, 10);
        const managerResult = await client.query(
            `INSERT INTO users (email, password_hash, name, role, gym_id)
             VALUES ($1, $2, $3, 'manager', $4)
             RETURNING id, email, name`,
            [managerEmail, passwordHash, managerName, gym.id]
        );
        manager = managerResult.rows[0];

        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }

    // Write the printable poster
    const outDir = path.resolve(__dirname, 'output');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const posterPath = path.join(outDir, `poster-${slugify(gymName)}.html`);
    fs.writeFileSync(posterPath, buildPosterHtml({ gymName: gym.name, gymId: gym.id }), 'utf8');

    console.log(`
✅ Gym pilot ready!

  Gym:           ${gym.name}
  Gym ID:        ${gym.id}
  Gym code:      ${gym.qr_code}   (members join with this in Settings → Gym, or at registration)
  Capacity:      ${gym.capacity}   (drives the green/yellow/red crowd light — manager can change later)

  Manager login: ${manager.email}
  Password:      ${password}   ${args.password ? '' : '(auto-generated — share securely, change after first login)'}

  QR poster:     ${posterPath}
                 → open in a browser, print on A4, tape it at the front desk

  Next steps:
  1. Log into the app as the manager and add trainers/members (or let members self-register with gym code ${gym.qr_code})
  2. Watch the dashboard: at-risk list + week-4 retention update automatically
`);

    await pool.end();
}

main().catch(err => {
    console.error('❌ Failed:', err.message);
    process.exit(1);
});
