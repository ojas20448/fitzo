module.exports = function (api) {
    api.cache(true);
    return {
        presets: ['babel-preset-expo'],
        plugins: [
            'transform-import-meta',
            'react-native-reanimated/plugin',
        ],
    };
};
