const { withAndroidManifest, withMainActivity, withDangerousMod } = require('@expo/config-plugins');
const fs = require('node:fs/promises');
const path = require('node:path');

// react-native-health-connect 3.5's Expo plugin only adds a rationale intent.
// Its permission launcher still needs to be registered by the host activity.
function configureMainActivity(contents) {
    if (contents.includes('HealthConnectPermissionDelegate.setPermissionDelegate(this)')) return contents;
    const onCreate = /(super\.onCreate\([^\n]*\)\s*;?)/;
    if (!onCreate.test(contents)) throw new Error('Cannot register Health Connect: MainActivity.onCreate was not found.');
    return contents.replace(/^(package [^\r\n]+[\r\n]+)/m,
        '$1import dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate\n')
        .replace(onCreate, '$1\n    HealthConnectPermissionDelegate.setPermissionDelegate(this)');
}

function configureManifest(manifest) {
    const app = manifest.application[0];
    // Route the pre-14 privacy intent to a dedicated activity instead of merely
    // launching the app's home screen, as the dependency plugin does.
    for (const activity of app.activity ?? []) {
        activity['intent-filter'] = (activity['intent-filter'] ?? []).filter(filter =>
            !filter.action?.some(action => action.$['android:name'] === 'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE'));
    }
    app.activity ??= [];
    if (!app.activity.some(activity => activity.$['android:name'] === '.HealthPermissionsActivity')) {
        app.activity.push({
            $: { 'android:name': '.HealthPermissionsActivity', 'android:exported': 'true' },
            'intent-filter': [{ action: [{ $: { 'android:name': 'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE' } }] }],
        });
    } else {
        app.activity.find(activity => activity.$['android:name'] === '.HealthPermissionsActivity')['intent-filter'] = [
            { action: [{ $: { 'android:name': 'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE' } }] },
        ];
    }
    app['activity-alias'] ??= [];
    if (!app['activity-alias'].some(alias => alias.$['android:name'] === 'ViewHealthPermissionUsageActivity')) {
        app['activity-alias'].push({
            $: {
                'android:name': 'ViewHealthPermissionUsageActivity',
                'android:exported': 'true',
                'android:targetActivity': '.HealthPermissionsActivity',
                'android:permission': 'android.permission.START_VIEW_PERMISSION_USAGE',
            },
            'intent-filter': [{
                action: [{ $: { 'android:name': 'android.intent.action.VIEW_PERMISSION_USAGE' } }],
                category: [{ $: { 'android:name': 'android.intent.category.HEALTH_PERMISSIONS' } }],
            }],
        });
    }
    if (!manifest.queries?.length) manifest.queries = [{}];
    if (!manifest.queries.some(query => query.package?.some(pkg => pkg.$['android:name'] === 'com.google.android.apps.healthdata'))) {
        manifest.queries[0].package ??= [];
        manifest.queries[0].package.push({ $: { 'android:name': 'com.google.android.apps.healthdata' } });
    }
}

function rationaleActivity(packageName) {
    return `package ${packageName}

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Bundle

class HealthPermissionsActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        try {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://www.fitzoapp.in/privacy-policy")))
        } catch (_: ActivityNotFoundException) {
            // A device without a browser can still return to Health Connect.
        }
        finish()
    }
}
`;
}

function withHealthConnect(config) {
    config = withMainActivity(config, config => {
        if (config.modResults.language !== 'kt') throw new Error('Fitzo Health Connect setup requires Kotlin MainActivity.');
        config.modResults.contents = configureMainActivity(config.modResults.contents);
        return config;
    });
    config = withAndroidManifest(config, config => {
        configureManifest(config.modResults.manifest);
        return config;
    });
    return withDangerousMod(config, ['android', async config => {
        const packageName = config.android.package;
        const dir = path.join(config.modRequest.platformProjectRoot, 'app/src/main/java', ...packageName.split('.'));
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(path.join(dir, 'HealthPermissionsActivity.kt'), rationaleActivity(packageName));
        return config;
    }]);
}

module.exports = withHealthConnect;
module.exports.configureMainActivity = configureMainActivity;
module.exports.configureManifest = configureManifest;
module.exports.rationaleActivity = rationaleActivity;
