const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pluginPath = path.join(__dirname, '..', 'withHealthConnect.js');
const template = `package com.fitzo.app
import android.os.Bundle
class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(null)
  }
}`;

test('native health permission setup is included in Expo builds', () => {
    const { expo } = require('../../app.json');
    assert.ok(expo.plugins.includes('./plugins/withHealthConnect'));
    assert.ok(fs.existsSync(pluginPath));
});

test('registers the permission delegate after onCreate and is safe to prebuild again', () => {
    const { configureMainActivity } = require(pluginPath);
    const result = configureMainActivity(template);
    assert.match(result, /import dev\.matinzd\.healthconnect\.permissions\.HealthConnectPermissionDelegate/);
    assert.match(result, /super\.onCreate\(null\)\s+HealthConnectPermissionDelegate\.setPermissionDelegate\(this\)/);
    assert.equal(configureMainActivity(result), result);
});

test('generates rationale entry points for both Android permission flows', () => {
    const { configureManifest, rationaleActivity } = require(pluginPath);
    const manifest = { application: [{ activity: [{ $: { 'android:name': '.MainActivity' }, 'intent-filter': [] }] }] };
    configureManifest(manifest);
    const first = JSON.stringify(manifest);
    configureManifest(manifest);
    assert.equal(JSON.stringify(manifest), first);
    const app = manifest.application[0];
    const activity = app.activity.find(a => a.$['android:name'] === '.HealthPermissionsActivity');
    assert.equal(activity['intent-filter'][0].action[0].$['android:name'], 'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE');
    const alias = app['activity-alias'][0];
    assert.equal(alias.$['android:targetActivity'], '.HealthPermissionsActivity');
    assert.equal(alias.$['android:permission'], 'android.permission.START_VIEW_PERMISSION_USAGE');
    assert.equal(alias['intent-filter'][0].category[0].$['android:name'], 'android.intent.category.HEALTH_PERMISSIONS');
    assert.match(rationaleActivity('com.fitzo.app'), /https:\/\/www\.fitzoapp\.in\/privacy-policy/);
    assert.equal(manifest.queries[0].package[0].$['android:name'], 'com.google.android.apps.healthdata');
});
