/**
 * Upload Exercise Images to Supabase Storage
 * 
 * Downloads images from GitHub free-exercise-db and uploads them
 * to Supabase Storage bucket "exercise-images", then outputs a
 * URL mapping JSON for updating defaultExercises.ts.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// ── Config ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://pieyjxokfjvsnfygblmv.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpZXlqeG9rZmp2c25meWdibG12Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODUwODYwNCwiZXhwIjoyMDg0MDg0NjA0fQ.rAfGgaHU18QbbwxMousdLluEvvhQbMB6KAV64H-T4-o';
const BUCKET_NAME = 'exercise-images';

// ── Read exercise file and extract unique GitHub URLs ───────────────────────
const exerciseFilePath = path.join(__dirname, '..', '..', 'mobile', 'src', 'data', 'defaultExercises.ts');
const exerciseFileContent = fs.readFileSync(exerciseFilePath, 'utf-8');

const githubUrlRegex = /https:\/\/raw\.githubusercontent\.com\/yuhonas\/free-exercise-db\/main\/exercises\/([^'"\s]+)/g;
const urlSet = new Set();
let match;
while ((match = githubUrlRegex.exec(exerciseFileContent)) !== null) {
    urlSet.add(match[0]);
}
const uniqueUrls = [...urlSet];
console.log(`Found ${uniqueUrls.length} unique GitHub image URLs\n`);

// ── Helpers ─────────────────────────────────────────────────────────────────

function downloadBuffer(url) {
    return new Promise((resolve, reject) => {
        const doRequest = (reqUrl, redirectCount = 0) => {
            if (redirectCount > 5) return reject(new Error('Too many redirects'));
            const mod = reqUrl.startsWith('https') ? https : require('http');
            mod.get(reqUrl, (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    return doRequest(res.headers.location, redirectCount + 1);
                }
                if (res.statusCode !== 200) {
                    return reject(new Error(`HTTP ${res.statusCode} for ${reqUrl}`));
                }
                const chunks = [];
                res.on('data', c => chunks.push(c));
                res.on('end', () => resolve(Buffer.concat(chunks)));
                res.on('error', reject);
            }).on('error', reject);
        };
        doRequest(url);
    });
}

function supabaseRequest(method, urlPath, body, contentType = 'application/json') {
    return new Promise((resolve, reject) => {
        const url = new URL(urlPath, SUPABASE_URL);
        const options = {
            method,
            hostname: url.hostname,
            path: url.pathname + url.search,
            headers: {
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'apikey': SUPABASE_SERVICE_KEY,
            }
        };
        if (body) {
            options.headers['Content-Type'] = contentType;
            if (Buffer.isBuffer(body)) {
                options.headers['Content-Length'] = body.length;
            }
        }

        const req = https.request(options, (res) => {
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => {
                const raw = Buffer.concat(chunks).toString('utf-8');
                let parsed;
                try { parsed = JSON.parse(raw); } catch { parsed = raw; }
                resolve({ status: res.statusCode, data: parsed });
            });
        });
        req.on('error', reject);
        if (body) req.write(Buffer.isBuffer(body) ? body : JSON.stringify(body));
        req.end();
    });
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
    // 1. Create bucket (ignore if already exists)
    console.log('Creating storage bucket...');
    const createRes = await supabaseRequest('POST', '/storage/v1/bucket', {
        id: BUCKET_NAME,
        name: BUCKET_NAME,
        public: true,
        file_size_limit: 5242880, // 5MB
        allowed_mime_types: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    });
    if (createRes.status === 200 || createRes.status === 201) {
        console.log('✅ Bucket created successfully');
    } else if (createRes.data?.message?.includes('already exists') || createRes.status === 409) {
        console.log('ℹ️  Bucket already exists, continuing...');
    } else {
        console.log('Bucket creation response:', createRes.status, JSON.stringify(createRes.data));
    }

    // 2. Download & upload each image
    const urlMapping = {}; // oldUrl -> newUrl
    let success = 0;
    let failed = 0;
    let skipped = 0;

    for (let i = 0; i < uniqueUrls.length; i++) {
        const githubUrl = uniqueUrls[i];
        // Extract exercise folder name & filename, e.g. "Barbell_Bench_Press_-_Medium_Grip/0.jpg"
        const pathMatch = githubUrl.match(/exercises\/(.+)/);
        if (!pathMatch) {
            console.log(`⚠️  Could not parse path from: ${githubUrl}`);
            failed++;
            continue;
        }

        const storagePath = pathMatch[1]; // e.g. "Barbell_Bench_Press_-_Medium_Grip/0.jpg"
        const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${storagePath}`;

        // Check if already uploaded
        const checkRes = await supabaseRequest('GET',
            `/storage/v1/object/info/public/${BUCKET_NAME}/${storagePath}`);
        if (checkRes.status === 200) {
            console.log(`[${i + 1}/${uniqueUrls.length}] ⏭️  Already exists: ${storagePath}`);
            urlMapping[githubUrl] = publicUrl;
            skipped++;
            continue;
        }

        // Download from GitHub
        let imageBuffer;
        try {
            imageBuffer = await downloadBuffer(githubUrl);
        } catch (err) {
            console.log(`[${i + 1}/${uniqueUrls.length}] ❌ Download failed: ${storagePath} - ${err.message}`);
            failed++;
            continue;
        }

        // Determine content type
        const ext = path.extname(storagePath).toLowerCase();
        const mimeMap = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp' };
        const contentType = mimeMap[ext] || 'image/jpeg';

        // Upload to Supabase Storage
        const uploadRes = await supabaseRequest(
            'POST',
            `/storage/v1/object/${BUCKET_NAME}/${storagePath}`,
            imageBuffer,
            contentType
        );

        if (uploadRes.status === 200 || uploadRes.status === 201) {
            console.log(`[${i + 1}/${uniqueUrls.length}] ✅ Uploaded: ${storagePath} (${(imageBuffer.length / 1024).toFixed(1)}KB)`);
            urlMapping[githubUrl] = publicUrl;
            success++;
        } else {
            console.log(`[${i + 1}/${uniqueUrls.length}] ❌ Upload failed: ${storagePath} - ${JSON.stringify(uploadRes.data)}`);
            failed++;
        }

        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 150));
    }

    console.log(`\n── Results ──`);
    console.log(`✅ Uploaded: ${success}`);
    console.log(`⏭️  Skipped (already exists): ${skipped}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`Total: ${uniqueUrls.length}`);

    // 3. Save mapping
    const mappingPath = path.join(__dirname, 'exercise_url_mapping.json');
    fs.writeFileSync(mappingPath, JSON.stringify(urlMapping, null, 2));
    console.log(`\n💾 URL mapping saved to: ${mappingPath}`);

    // 4. Update the exercise file
    if (Object.keys(urlMapping).length > 0) {
        console.log('\n📝 Updating defaultExercises.ts with Supabase URLs...');
        let updatedContent = exerciseFileContent;
        for (const [oldUrl, newUrl] of Object.entries(urlMapping)) {
            updatedContent = updatedContent.split(oldUrl).join(newUrl);
        }
        fs.writeFileSync(exerciseFilePath, updatedContent, 'utf-8');
        console.log('✅ defaultExercises.ts updated!');
    }
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
