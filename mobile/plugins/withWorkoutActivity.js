const { withInfoPlist, withXcodeProject, withDangerousMod } = require('@expo/config-plugins');
const fs = require('node:fs/promises');
const path = require('node:path');

const TARGET = 'FitzoWorkoutWidget';
const SOURCES = [`${TARGET}/FitzoWorkoutWidget.swift`, `${TARGET}/FitzoWorkoutAttributes.swift`];

function configureXcodeProject(project, config) {
    const objects = project.hash.project.objects;
    let entry = Object.entries(project.pbxNativeTargetSection()).find(([id, value]) =>
        !id.endsWith('_comment') && value.name?.replaceAll('"', '') === TARGET);
    if (!entry) {
        // xcode.addTarget embeds an app extension and adds its dependency to the host app.
        const target = project.addTarget(TARGET, 'app_extension', TARGET, `${config.ios.bundleIdentifier}.workout`);
        project.addBuildPhase(SOURCES, 'PBXSourcesBuildPhase', 'Sources', target.uuid);
        project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', target.uuid);
        project.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', target.uuid);
        const group = project.addPbxGroup([...SOURCES, `${TARGET}/Info.plist`], TARGET);
        project.addToPbxGroup({ fileRef: group.uuid, basename: TARGET }, project.getFirstProject().firstProject.mainGroup);
        entry = [target.uuid, target.pbxNativeTarget];
    }
    const target = entry[1];
    const list = objects.XCConfigurationList[target.buildConfigurationList];
    for (const ref of list.buildConfigurations) {
        const settings = objects.XCBuildConfiguration[ref.value].buildSettings;
        Object.assign(settings, {
            PRODUCT_BUNDLE_IDENTIFIER: `"${config.ios.bundleIdentifier}.workout"`,
            PRODUCT_NAME: `"${TARGET}"`,
            INFOPLIST_FILE: `"${TARGET}/Info.plist"`,
            IPHONEOS_DEPLOYMENT_TARGET: '16.2',
            SWIFT_VERSION: '5.9',
            APPLICATION_EXTENSION_API_ONLY: 'YES',
            CLANG_ENABLE_MODULES: 'YES',
            CODE_SIGN_STYLE: 'Automatic',
            CURRENT_PROJECT_VERSION: config.ios.buildNumber || '1',
            MARKETING_VERSION: config.version || '1.0.0',
            TARGETED_DEVICE_FAMILY: '"1"',
            SKIP_INSTALL: 'YES',
            GENERATE_INFOPLIST_FILE: 'NO',
        });
        if (config.ios.appleTeamId) settings.DEVELOPMENT_TEAM = config.ios.appleTeamId;
    }
    return project;
}

function withWorkoutActivity(config) {
    config = withInfoPlist(config, config => {
        config.modResults.NSSupportsLiveActivities = true;
        return config;
    });
    // Declare the extension before prebuild so EAS can provision its signing credentials.
    config.extra ??= {};
    config.extra.eas ??= {};
    config.extra.eas.build ??= {};
    config.extra.eas.build.experimental ??= {};
    config.extra.eas.build.experimental.ios ??= {};
    const ios = config.extra.eas.build.experimental.ios;
    ios.appExtensions ??= [];
    if (!ios.appExtensions.some(extension => extension.targetName === TARGET)) {
        ios.appExtensions.push({ targetName: TARGET, bundleIdentifier: `${config.ios.bundleIdentifier}.workout`, entitlements: {} });
    }
    config = withDangerousMod(config, ['ios', async config => {
        const output = path.join(config.modRequest.platformProjectRoot, TARGET);
        const native = path.join(config.modRequest.projectRoot, 'modules/fitzo-workout-activity');
        await fs.mkdir(output, { recursive: true });
        await fs.copyFile(path.join(native, 'widget/FitzoWorkoutWidget.swift'), path.join(output, 'FitzoWorkoutWidget.swift'));
        await fs.copyFile(path.join(native, 'ios/FitzoWorkoutAttributes.swift'), path.join(output, 'FitzoWorkoutAttributes.swift'));
        const plist = require('@expo/plist').default;
        await fs.writeFile(path.join(output, 'Info.plist'), plist.build({
            CFBundleDisplayName: 'Fitzo Workout',
            CFBundleExecutable: '$(EXECUTABLE_NAME)',
            CFBundleIdentifier: '$(PRODUCT_BUNDLE_IDENTIFIER)',
            CFBundleInfoDictionaryVersion: '6.0',
            CFBundleName: '$(PRODUCT_NAME)',
            CFBundlePackageType: 'XPC!',
            CFBundleShortVersionString: '$(MARKETING_VERSION)',
            CFBundleVersion: '$(CURRENT_PROJECT_VERSION)',
            NSExtension: { NSExtensionPointIdentifier: 'com.apple.widgetkit-extension' },
        }));
        return config;
    }]);
    return withXcodeProject(config, config => {
        configureXcodeProject(config.modResults, config);
        return config;
    });
}

module.exports = withWorkoutActivity;
module.exports.configureXcodeProject = configureXcodeProject;
module.exports.TARGET = TARGET;
