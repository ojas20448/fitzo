const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Fix for zustand and other ESM packages using import.meta on web
config.resolver.unstable_enablePackageExports = false;

// Force zustand to use CommonJS version instead of ESM
config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (platform === 'web' && moduleName === 'zustand') {
        return {
            filePath: path.resolve(__dirname, 'node_modules/zustand/index.js'),
            type: 'sourceFile',
        };
    }
    // Force axios to use browser bundle on native platforms (avoids Node.js crypto/http imports)
    if (moduleName === 'axios' && platform !== 'web') {
        return {
            filePath: path.resolve(__dirname, 'node_modules/axios/dist/browser/axios.cjs'),
            type: 'sourceFile',
        };
    }
    // Let Metro handle the rest
    return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
