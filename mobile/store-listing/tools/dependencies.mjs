import { createRequire } from 'node:module';
import path from 'node:path';

// Optional existing tool installation; otherwise use this folder's npm install.
const require = createRequire(process.env.FITZO_ARTWORK_DEPENDENCIES
  ? path.resolve(process.env.FITZO_ARTWORK_DEPENDENCIES, 'package.json')
  : import.meta.url);
export const { chromium } = require('playwright');
export const sharp = require('sharp');
