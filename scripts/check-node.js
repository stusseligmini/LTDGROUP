#!/usr/bin/env node
const semver = require('semver');

const REQUIRED = '20.0.0';
const current = process.version.replace(/^v/, '');

if (!semver.valid(current)) {
  console.error(`Unable to parse Node version: ${process.version}`);
  process.exit(1);
}

if (!semver.satisfies(current, `~${REQUIRED}`)) {
  console.warn(`⚠️  Node ${current} detected; recommended ~${REQUIRED} (matches Firebase Functions runtime). Continuing...`);
  process.exitCode = 0;
} else {
  console.log(`✅ Node ${current} matches recommended ~${REQUIRED}`);
}
