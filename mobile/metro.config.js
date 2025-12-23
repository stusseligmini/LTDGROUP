const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

// Get default Metro configuration
const defaultConfig = getDefaultConfig(__dirname);

// Configure Metro to resolve modules from parent directory
const config = {
  watchFolders: [
    path.resolve(__dirname, '..'),
  ],
  resolver: {
    extraNodeModules: {
      // Allow importing from parent src/lib
      '@': path.resolve(__dirname, '../src'),
      '@/lib': path.resolve(__dirname, '../src/lib'),
      '@/types': path.resolve(__dirname, '../src/types'),
    },
    nodeModulesPaths: [
      path.resolve(__dirname, 'node_modules'),
      path.resolve(__dirname, '../node_modules'),
    ],
  },
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
};

module.exports = mergeConfig(defaultConfig, config);

