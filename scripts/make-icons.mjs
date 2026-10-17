// Draws the app icons as PNG files with no dependencies: a blue tile with a white "T" on the dark background.
// The tile sits inside the central 60%, so the same image works where systems crop icons to a circle.
// Run: node scripts/make-icons.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync, crc32 } from 'node:zlib';

const BG = [10, 13, 18];
const TILE = [59, 123, 234];
const INK = [255, 255, 255];

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([len, body, crc]);
}

function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel(x, y);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/** Colour at a point in a unit square, before anti-aliasing. */
function shade(u, v) {
  const tile = 0.6, r = 0.12, lo = (1 - tile) / 2, hi = 1 - lo;
  const dx = Math.max(lo + r - u, 0, u - (hi - r));
  const dy = Math.max(lo + r - v, 0, v - (hi - r));
  const inTile = u >= lo && u <= hi && v >= lo && v <= hi && dx * dx + dy * dy <= r * r;
  if (!inTile) return BG;
  const bar = v >= 0.36 && v <= 0.44 && u >= 0.36 && u <= 0.64;
  const stem = u >= 0.46 && u <= 0.54 && v >= 0.36 && v <= 0.66;
  return bar || stem ? INK : TILE;
}

function icon(size) {
  const ss = 4;
  return png(size, (x, y) => {
    const acc = [0, 0, 0];
    for (let i = 0; i < ss; i++) for (let j = 0; j < ss; j++) {
      const c = shade((x + (i + 0.5) / ss) / size, (y + (j + 0.5) / ss) / size);
      acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2];
    }
    return acc.map((a) => Math.round(a / (ss * ss)));
  });
}

mkdirSync('public/icons', { recursive: true });
for (const size of [180, 192, 512]) writeFileSync(`public/icons/icon-${size}.png`, icon(size));
console.log('Wrote public/icons/icon-180.png, icon-192.png, icon-512.png');
