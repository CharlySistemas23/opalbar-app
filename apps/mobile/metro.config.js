const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

process.env.EXPO_ROUTER_APP_ROOT = 'app';

const config = getDefaultConfig(projectRoot);

config.watchFolders = [projectRoot, monorepoRoot];

// Nx cache paths are ephemeral; excluding them avoids ENOENT watch crashes.
config.resolver.blockList = [
  new RegExp(`${monorepoRoot.replace(/[/\\]/g, '[/\\\\]')}[/\\\\]\\.nx[/\\\\]cache[/\\\\].*`),
];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Ensure font assets are recognized — important for @expo-google-fonts/*
// which ship .ttf files under node_modules subfolders.
config.resolver.assetExts = Array.from(
  new Set([...(config.resolver.assetExts || []), 'ttf', 'otf', 'woff', 'woff2']),
);

module.exports = config;
