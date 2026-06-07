const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Resolve .web.ts/.web.tsx before .ts/.tsx so platform shims take precedence on web
config.resolver.sourceExts = [
  'web.tsx',
  'web.ts',
  'web.js',
  ...config.resolver.sourceExts,
];

module.exports = config;
