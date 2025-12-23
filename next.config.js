/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fix workspace root detection warning
  outputFileTracingRoot: __dirname,
  
  // Image optimization configuration
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'celora.net',
      },
    ],
  },
  
  // Performance optimizations
  compress: true,
  poweredByHeader: false,
  
  // Next.js 15 configuration
  experimental: {},
  
  // Compiler optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  // Migrate from deprecated experimental.turbo to turbopack
  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },
  
  // Enable strict TypeScript checking for better code quality
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Enhanced security headers
  async headers() {
    return [
      // AGGRESSIVE cache-busting for mobile browsers
      {
        source: '/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
          { key: 'X-Cache-Control', value: 'no-cache' },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.google.com https://www.gstatic.com https://www.recaptcha.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https: blob:; connect-src 'self' https: wss: https://*.firebaseio.com https://*.googleapis.com; frame-src 'self' https://*.telegram.org https://web.telegram.org https://*.t.me https://www.google.com https://www.recaptcha.net; frame-ancestors https://*.telegram.org https://web.telegram.org https://*.t.me; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self';"
          },
        ],
      },
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate',
          },
        ],
      },
    ];
  },

  // Friendly asset aliases so we can standardize public paths without moving files
  async rewrites() {
    return [
      // Proxy legacy middleware responsibilities to destinations as needed
      {
        source: '/images/celora-wordmark.png',
        destination: '/b3bdb21c-1e40-42a7-b4c4-d45543aa4159.png',
      },
      {
        source: '/images/celora-lock.png',
        destination: '/images/93bd0c27-6490-469d-a1d9-8cde4626aa08.png',
      },
      // Example proxies (adjust as required):
      {
        source: '/api/username',
        destination: '/api/username',
      },
      {
        source: '/offline',
        destination: '/offline',
      },
    ];
  },

  // Host-level redirects are handled by Firebase Hosting; keep Next.js config minimal here

  // Webpack configuration for better module resolution and performance
  webpack: (config, { isServer, dev }) => {
    // Enable WebAssembly support for tiny-secp256k1
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // Optimize for client-side bundles
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        buffer: require.resolve('buffer/'),
      };
      
      // Polyfill Buffer for client-side crypto operations
      const webpack = require('webpack');
      config.plugins.push(
        new webpack.ProvidePlugin({
          Buffer: ['buffer', 'Buffer'],
        })
      );
    }
    
    // Optimize webpack cache to reduce serialization warnings
    if (!dev) {
      config.cache = {
        type: 'filesystem',
        buildDependencies: {
          config: [__filename],
        },
        compression: 'gzip',
      };
      
      // Optimize chunk splitting to reduce large strings in cache
      config.optimization.splitChunks = {
        ...config.optimization.splitChunks,
        cacheGroups: {
          ...config.optimization.splitChunks?.cacheGroups,
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
            maxSize: 244000, // Keep chunks under 244KB to avoid serialization warnings
          },
        },
      };
    }
    
    // Add externals for Edge Runtime compatibility
    if (isServer) {
      config.externals = [...(config.externals || []), 'canvas', 'jsdom'];
    }

    // Simplified: remove custom thread-stream/pino stubbing since WalletConnect disabled.
    // Preserve only essential experiment flags already removed.
    
    return config;
  },
};

module.exports = nextConfig;