// Renders the app icons and brand files from the Progress Tracker seal (owner's design, in the
// app's primary blue). Run with `npm run icons` after changing the design.
import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const BLUE = '#1E40AF';

/** The mark inside the seal: the ring, the roof (rising progress) and the base line, on a 1024 grid. */
const MARK = `
  <circle cx="512" cy="512" r="457" fill="none" stroke="#fff" stroke-width="26"/>
  <polyline points="283,525 512,365 741,525" fill="none" stroke="#fff" stroke-width="58" stroke-linejoin="miter"/>
  <rect x="283" y="631" width="458" height="47" fill="#fff"/>`;

/**
 * shape: 'circle' (the seal itself, transparent corners) or 'square' (full-bleed blue, for maskable
 * and iOS icons). `scale` shrinks the mark inside the canvas: maskable icons need an 80% safe zone.
 */
function svg({ shape, scale = 1, mono = false }) {
  // Android's notification badge: white mark only, on transparent (Android tints it itself).
  if (mono) return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${MARK}</svg>`;
  const off = (1024 - 1024 * scale) / 2;
  const bg = shape === 'circle' ? `<circle cx="512" cy="512" r="512" fill="${BLUE}"/>` : `<rect width="1024" height="1024" fill="${BLUE}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${bg}<g transform="translate(${off} ${off}) scale(${scale})">${MARK}</g></svg>`;
}

const out = [
  // "any" purpose: the round seal
  { file: 'public/pwa-192x192.png', size: 192, shape: 'circle' },
  { file: 'public/pwa-512x512.png', size: 512, shape: 'circle' },
  // maskable (Android adaptive icons): full-bleed blue, the mark inside the central safe zone
  { file: 'public/maskable-192x192.png', size: 192, shape: 'square', scale: 0.78 },
  { file: 'public/maskable-512x512.png', size: 512, shape: 'square', scale: 0.78 },
  // iOS home screen (iOS rounds the corners itself)
  { file: 'public/apple-touch-icon-180x180.png', size: 180, shape: 'square', scale: 0.92 },
  // Browser tab fallback for browsers without SVG icons
  { file: 'public/favicon-48.png', size: 48, shape: 'circle' },
  // Android status-bar badge for push notifications
  { file: 'public/badge-96.png', size: 96, shape: 'circle', mono: true },
  // Brand files for stores, Google sign-in and documents
  { file: 'brand/progress-tracker-logo-64.png', size: 64, shape: 'circle' },
  { file: 'brand/progress-tracker-logo-120.png', size: 120, shape: 'circle' },
  { file: 'brand/progress-tracker-logo-512.png', size: 512, shape: 'circle' },
  { file: 'brand/progress-tracker-logo-1024.png', size: 1024, shape: 'circle' },
];

mkdirSync('brand', { recursive: true });
for (const o of out) {
  const png = new Resvg(svg(o), { fitTo: { mode: 'width', value: o.size } }).render().asPng();
  writeFileSync(o.file, png);
  console.log(`${o.file} (${png.length} bytes)`);
}

// Link preview card (WhatsApp, X, LinkedIn…): 1200×630, the seal centred on the app's light background.
const og = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#F1F5FF"/>
  <g transform="translate(395 110) scale(0.4)"><circle cx="512" cy="512" r="512" fill="${BLUE}"/>${MARK}</g>
</svg>`;
writeFileSync('public/og-image.png', new Resvg(og, { fitTo: { mode: 'width', value: 1200 } }).render().asPng());
console.log('public/og-image.png');

// The browser-tab icon and the master vector.
writeFileSync('public/favicon.svg', svg({ shape: 'circle' }) + '\n');
writeFileSync('brand/progress-tracker-logo.svg', svg({ shape: 'circle' }) + '\n');
console.log('public/favicon.svg, brand/progress-tracker-logo.svg');
