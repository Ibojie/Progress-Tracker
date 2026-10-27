// Renders the app icons from SVG. Run with `npm run icons` after changing the design.
import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const BLUE = '#1E40AF';

/** The target mark; `scale` shrinks it inside the canvas (maskable icons need a safe zone). */
function svg({ rounded, scale }) {
  const r = rounded ? 112 : 0;
  const s = scale;
  const off = (512 - 512 * s) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${r}" fill="${BLUE}"/>
  <g transform="translate(${off} ${off}) scale(${s})" fill="none" stroke="#fff" stroke-width="40">
    <circle cx="256" cy="256" r="144"/>
    <circle cx="256" cy="256" r="64"/>
  </g>
  <circle cx="256" cy="256" r="${20 * s}" fill="#fff"/>
</svg>`;
}

const out = [
  // "any" purpose: rounded tile, mark fills it
  { file: 'public/pwa-192x192.png', size: 192, rounded: true, scale: 1 },
  { file: 'public/pwa-512x512.png', size: 512, rounded: true, scale: 1 },
  // maskable: full-bleed, mark inside the central 80% safe zone
  { file: 'public/maskable-512x512.png', size: 512, rounded: false, scale: 0.7 },
  // iOS home screen (iOS rounds the corners itself)
  { file: 'public/apple-touch-icon-180x180.png', size: 180, rounded: false, scale: 0.85 },
];

for (const o of out) {
  const png = new Resvg(svg(o), { fitTo: { mode: 'width', value: o.size } }).render().asPng();
  writeFileSync(o.file, png);
  console.log(`${o.file} (${png.length} bytes)`);
}
