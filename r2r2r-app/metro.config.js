const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Metro already resolves platform-specific files (foo.web.ts before foo.ts)
// when building for web — no extra sourceExts needed.
// Just ensure JSON modules resolve correctly.
config.resolver.assetExts = config.resolver.assetExts.filter((ext) => ext !== 'svg');

module.exports = config;
