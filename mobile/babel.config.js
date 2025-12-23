module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./src', '../src'],
        extensions: [
          '.ios.ts',
          '.android.ts',
          '.ts',
          '.ios.tsx',
          '.android.tsx',
          '.tsx',
          '.jsx',
          '.js',
          '.json',
        ],
        alias: {
          '@': '../src',
          '@/lib': '../src/lib',
          '@/types': '../src/types',
        },
      },
    ],
    'react-native-reanimated/plugin',
  ],
};

