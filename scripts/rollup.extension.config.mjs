import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import alias from '@rollup/plugin-alias';
import replace from '@rollup/plugin-replace';
import typescript from '@rollup/plugin-typescript';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

export default [
  // Popup bundle
  {
    input: path.join(rootDir, 'extension/src/popup.tsx'),
    output: {
      file: path.join(rootDir, 'extension/dist/popup.js'),
      format: 'iife',
      name: 'CeloraExtension',
      sourcemap: false,
      globals: {
        'react': 'React',
        'react-dom': 'ReactDOM',
        'react-dom/client': 'ReactDOMClient',
      },
    },
    external: ['react', 'react-dom', 'react-dom/client'],
    plugins: [
      replace({
        'process.env.NODE_ENV': JSON.stringify('production'),
        'process.env.NEXT_PUBLIC_APP_URL': JSON.stringify('https://celora-7b552.web.app'),
        'process.env.NEXT_PUBLIC_API_BASE_URL': JSON.stringify('https://celora-7b552.web.app/api'),
        preventAssignment: true,
      }),
      alias({
        entries: [
          { find: '@', replacement: path.join(rootDir, 'src') },
          { find: '@/providers', replacement: path.join(rootDir, 'src/providers') },
          { find: '@/components', replacement: path.join(rootDir, 'src/components') },
          { find: '@/hooks', replacement: path.join(rootDir, 'src/hooks') },
          { find: '@/lib', replacement: path.join(rootDir, 'src/lib') },
        ],
      }),
      nodeResolve({
        extensions: ['.tsx', '.ts', '.jsx', '.js'],
        browser: true,
        preferBuiltins: false,
      }),
      commonjs({
        include: /node_modules/,
        requireReturnsDefault: 'auto',
      }),
      typescript({
        tsconfig: path.join(rootDir, 'tsconfig.json'),
        jsx: 'react-jsx',
        declaration: false,
        declarationMap: false,
        noEmit: false,
        outDir: path.join(rootDir, 'extension/dist'),
      }),
    ],
    onwarn(warning, warn) {
      // Suppress certain warnings
      if (warning.code === 'THIS_IS_UNDEFINED') return;
      if (warning.code === 'CIRCULAR_DEPENDENCY') return;
      warn(warning);
    },
  },
  // Background service worker
  {
    input: path.join(rootDir, 'extension/background/service-worker.js'),
    output: {
      file: path.join(rootDir, 'extension/dist/background/service-worker.js'),
      format: 'iife',
      sourcemap: false,
    },
    plugins: [
      replace({
        'process.env.NODE_ENV': JSON.stringify('production'),
        preventAssignment: true,
      }),
      nodeResolve({
        browser: true,
        preferBuiltins: false,
      }),
      commonjs(),
    ],
  },
];
