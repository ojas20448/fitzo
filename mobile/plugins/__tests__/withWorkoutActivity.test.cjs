const { test } = require('node:test');
const assert = require('node:assert/strict');
const xcode = require('xcode');
const withWorkoutActivity = require('../withWorkoutActivity');
const { configureXcodeProject, TARGET } = withWorkoutActivity;

function fixture() {
    const project = xcode.project('project.pbxproj');
    project.hash = { project: { rootObject: 'PROJECT', archiveVersion: 1, objectVersion: 54, classes: {}, objects: {
        PBXProject: { PROJECT: { isa: 'PBXProject', mainGroup: 'MAIN', productRefGroup: 'PRODUCTS', targets: [{ value: 'APP', comment: 'Fitzo' }], attributes: {} } },
        PBXNativeTarget: { APP: { isa: 'PBXNativeTarget', name: 'Fitzo', buildConfigurationList: 'APP_CONFIGS', buildPhases: [], dependencies: [], productType: '"com.apple.product-type.application"' } },
        PBXGroup: {
            MAIN: { isa: 'PBXGroup', children: [{ value: 'PRODUCTS', comment: 'Products' }], sourceTree: '"<group>"' },
            PRODUCTS: { isa: 'PBXGroup', name: 'Products', children: [], sourceTree: '"<group>"' }, PRODUCTS_comment: 'Products',
        },
        PBXFileReference: {}, PBXBuildFile: {}, PBXSourcesBuildPhase: {}, PBXFrameworksBuildPhase: {}, PBXResourcesBuildPhase: {}, PBXCopyFilesBuildPhase: {},
        PBXContainerItemProxy: {}, PBXTargetDependency: {},
        XCBuildConfiguration: { APP_DEBUG: { isa: 'XCBuildConfiguration', name: 'Debug', buildSettings: {} }, APP_RELEASE: { isa: 'XCBuildConfiguration', name: 'Release', buildSettings: {} } },
        XCConfigurationList: { APP_CONFIGS: { isa: 'XCConfigurationList', buildConfigurations: [{ value: 'APP_DEBUG' }, { value: 'APP_RELEASE' }] } },
    } } };
    return project;
}
const config = { name: 'Fitzo', slug: 'fitzo', version: '1.4.1', ios: { bundleIdentifier: 'in.fitzoapp.fitzo', buildNumber: '25' } };
const targets = project => Object.entries(project.pbxNativeTargetSection()).filter(([key, value]) => !key.endsWith('_comment') && value.name?.replaceAll('"', '') === TARGET);

test('creates and embeds a WidgetKit target with both shared attributes and UI sources', () => {
    const project = configureXcodeProject(fixture(), config);
    const [id, target] = targets(project)[0];
    const objects = project.hash.project.objects;
    const sourcePhase = target.buildPhases.map(ref => objects.PBXSourcesBuildPhase[ref.value]).find(Boolean);
    assert.equal(sourcePhase.files.length, 2);
    const embedded = Object.entries(objects.PBXCopyFilesBuildPhase).filter(([key]) => !key.endsWith('_comment'))
        .some(([, phase]) => phase.files.some(ref => objects.PBXBuildFile[ref.value]?.fileRef === target.productReference));
    assert.equal(embedded, true);
    assert.ok(Object.values(objects.PBXTargetDependency).some(dependency => dependency.target === id));
    const settings = objects.XCConfigurationList[target.buildConfigurationList].buildConfigurations.map(ref => objects.XCBuildConfiguration[ref.value].buildSettings);
    assert.ok(settings.every(setting => setting.IPHONEOS_DEPLOYMENT_TARGET === '16.2' && setting.CURRENT_PROJECT_VERSION === '25'));
});

test('repeated generation keeps one extension and refreshes its version for the next store build', () => {
    const project = configureXcodeProject(fixture(), config);
    const before = Object.keys(project.hash.project.objects.PBXBuildFile).length;
    configureXcodeProject(project, { ...config, ios: { ...config.ios, buildNumber: '26' } });
    assert.equal(targets(project).length, 1);
    assert.equal(Object.keys(project.hash.project.objects.PBXBuildFile).length, before);
    const objects = project.hash.project.objects;
    const target = targets(project)[0][1];
    assert.ok(objects.XCConfigurationList[target.buildConfigurationList].buildConfigurations.every(ref => objects.XCBuildConfiguration[ref.value].buildSettings.CURRENT_PROJECT_VERSION === '26'));
});

test('declares extension signing for EAS while retaining other extension configurations', () => {
    const other = { targetName: 'OtherWidget', bundleIdentifier: 'in.fitzoapp.fitzo.other', entitlements: {} };
    const input = { ...config, extra: { eas: { build: { experimental: { ios: { appExtensions: [other] } } } } } };
    const output = withWorkoutActivity(withWorkoutActivity(input));
    assert.deepEqual(output.extra.eas.build.experimental.ios.appExtensions, [other, { targetName: TARGET, bundleIdentifier: 'in.fitzoapp.fitzo.workout', entitlements: {} }]);
});
