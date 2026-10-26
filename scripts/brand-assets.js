/* Generate AABL-branded image assets (no native image libs available).
 * - decodes ../aabl-logo-1.png (white wordmark, RGBA)
 * - writes an upscaled header logo over the app's existing logo files
 * - renders Android launcher icons (dark + gold ring + wordmark)
 * Run: node scripts/brand-assets.js
 */
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC_LOGO = path.resolve(ROOT, '..', 'aabl-logo-1.png');

// ---------- PNG codec ----------
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const tb = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([tb, data])), 0);
  return Buffer.concat([len, tb, data, crc]);
}
const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function decodePNG(buf) {
  if (!buf.slice(0, 8).equals(SIG)) throw new Error('not a png');
  let off = 8, W = 0, H = 0, bitDepth = 0, colorType = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.slice(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      W = data.readUInt32BE(0); H = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (bitDepth !== 8) throw new Error('need 8-bit png, got ' + bitDepth);
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 0 ? 1 : colorType === 4 ? 2 : 0;
  if (!channels) throw new Error('unsupported colorType ' + colorType);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = channels;
  const stride = W * bpp;
  const out = Buffer.alloc(H * stride);
  let rp = 0;
  for (let y = 0; y < H; y++) {
    const filter = raw[rp++];
    for (let x = 0; x < stride; x++) {
      const v = raw[rp++];
      const a = x >= bpp ? out[y * stride + x - bpp] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? out[(y - 1) * stride + x - bpp] : 0;
      let val;
      switch (filter) {
        case 0: val = v; break;
        case 1: val = v + a; break;
        case 2: val = v + b; break;
        case 3: val = v + ((a + b) >> 1); break;
        case 4: val = v + paeth(a, b, c); break;
        default: throw new Error('bad filter ' + filter);
      }
      out[y * stride + x] = val & 0xff;
    }
  }
  // normalise to RGBA
  const rgba = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    if (channels === 4) { rgba[i * 4] = out[i * 4]; rgba[i * 4 + 1] = out[i * 4 + 1]; rgba[i * 4 + 2] = out[i * 4 + 2]; rgba[i * 4 + 3] = out[i * 4 + 3]; }
    else if (channels === 3) { rgba[i * 4] = out[i * 3]; rgba[i * 4 + 1] = out[i * 3 + 1]; rgba[i * 4 + 2] = out[i * 3 + 2]; rgba[i * 4 + 3] = 255; }
    else if (channels === 1) { rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = out[i]; rgba[i * 4 + 3] = 255; }
    else { rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = out[i * 2]; rgba[i * 4 + 3] = out[i * 2 + 1]; }
  }
  return { width: W, height: H, data: rgba };
}

function encodePNG(img) {
  const { width: W, height: H, data } = img;
  const stride = W * 4;
  const raw = Buffer.alloc(H * (stride + 1));
  for (let y = 0; y < H; y++) {
    raw[y * (stride + 1)] = 0; // filter none
    data.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    SIG,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- pixel ops ----------
function newImg(w, h, rgba = [0, 0, 0, 0]) {
  const d = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) { d[i * 4] = rgba[0]; d[i * 4 + 1] = rgba[1]; d[i * 4 + 2] = rgba[2]; d[i * 4 + 3] = rgba[3]; }
  return { width: w, height: h, data: d };
}
function sample(src, sx, sy) {
  sx = Math.max(0, Math.min(src.width - 1, sx));
  sy = Math.max(0, Math.min(src.height - 1, sy));
  const x0 = Math.floor(sx), y0 = Math.floor(sy);
  const x1 = Math.min(src.width - 1, x0 + 1), y1 = Math.min(src.height - 1, y0 + 1);
  const fx = sx - x0, fy = sy - y0;
  const px = (x, y, c) => src.data[(y * src.width + x) * 4 + c];
  const out = [0, 0, 0, 0];
  for (let c = 0; c < 4; c++) {
    const top = px(x0, y0, c) * (1 - fx) + px(x1, y0, c) * fx;
    const bot = px(x0, y1, c) * (1 - fx) + px(x1, y1, c) * fx;
    out[c] = top * (1 - fy) + bot * fy;
  }
  return out;
}
function resize(src, w, h) {
  const dst = newImg(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const p = sample(src, ((x + 0.5) / w) * src.width - 0.5, ((y + 0.5) / h) * src.height - 0.5);
      const i = (y * w + x) * 4;
      dst.data[i] = p[0] | 0; dst.data[i + 1] = p[1] | 0; dst.data[i + 2] = p[2] | 0; dst.data[i + 3] = p[3] | 0;
    }
  return dst;
}
function blit(dst, src, dx, dy, tint) {
  for (let y = 0; y < src.height; y++)
    for (let x = 0; x < src.width; x++) {
      const X = dx + x, Y = dy + y;
      if (X < 0 || Y < 0 || X >= dst.width || Y >= dst.height) continue;
      const s = (y * src.width + x) * 4;
      let sr = src.data[s], sg = src.data[s + 1], sb = src.data[s + 2];
      const sa = src.data[s + 3] / 255;
      if (tint) { sr = tint[0]; sg = tint[1]; sb = tint[2]; }
      const d = (Y * dst.width + X) * 4;
      const da = dst.data[d + 3] / 255;
      const oa = sa + da * (1 - sa);
      if (oa === 0) continue;
      dst.data[d] = (sr * sa + dst.data[d] * da * (1 - sa)) / oa;
      dst.data[d + 1] = (sg * sa + dst.data[d + 1] * da * (1 - sa)) / oa;
      dst.data[d + 2] = (sb * sa + dst.data[d + 2] * da * (1 - sa)) / oa;
      dst.data[d + 3] = oa * 255;
    }
}
// solid rounded-rect / circle mask fill
function fillShape(img, color, radius, circle) {
  const { width: w, height: h } = img;
  const cx = w / 2, cy = h / 2, rr = Math.min(w, h) / 2;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let inside;
      if (circle) inside = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= rr - 0.5;
      else {
        const qx = Math.max(radius - x, x - (w - radius), 0);
        const qy = Math.max(radius - y, y - (h - radius), 0);
        inside = Math.hypot(qx, qy) <= radius;
      }
      if (inside) {
        const i = (y * w + x) * 4;
        img.data[i] = color[0]; img.data[i + 1] = color[1]; img.data[i + 2] = color[2]; img.data[i + 3] = 255;
      }
    }
}
function strokeRing(img, color, inset, thickness, circle) {
  const { width: w, height: h } = img;
  const cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2 - inset;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let dist;
      if (circle) dist = Math.abs(Math.hypot(x + 0.5 - cx, y + 0.5 - cy) - r);
      else {
        const qx = Math.max((inset) - x, x - (w - inset), 0);
        const qy = Math.max((inset) - y, y - (h - inset), 0);
        dist = Math.abs(Math.hypot(qx, qy));
        // approximate: only stroke near the inset border
        const near = Math.min(x, y, w - 1 - x, h - 1 - y);
        dist = Math.abs(near - inset);
      }
      if (dist <= thickness / 2) {
        const i = (y * w + x) * 4;
        img.data[i] = color[0]; img.data[i + 1] = color[1]; img.data[i + 2] = color[2]; img.data[i + 3] = 255;
      }
    }
}

// ---------- build ----------
const GOLD = [0xC8, 0x99, 0x30];
const INK = [0x0D, 0x0D, 0x0D];
const WHITE = [0xFF, 0xFF, 0xFF];

const logo = decodePNG(fs.readFileSync(SRC_LOGO));
console.log(`source logo ${logo.width}x${logo.height}`);

const IMG = path.join(ROOT, 'src', 'assets', 'images');
const RES = path.join(ROOT, 'android', 'app', 'src', 'main', 'res');

// 1) crisp header wordmark (~4x) — white, transparent bg
const headerW = logo.width * 4, headerH = logo.height * 4;
const header = resize(logo, headerW, headerH);
const headerPNG = encodePNG(header);
for (const name of ['aabl-logo.png', 'Emami1.png', 'emamiLogo.png', 'emami.png']) {
  fs.writeFileSync(path.join(IMG, name), headerPNG);
}
console.log(`wrote header wordmark ${headerW}x${headerH} -> aabl-logo.png (+ overwrote Emami1/emamiLogo/emami)`);

// dark version of the wordmark for light backgrounds
const darkMark = resize(logo, headerW, headerH);
for (let i = 0; i < darkMark.width * darkMark.height; i++) {
  darkMark.data[i * 4] = 0x1A; darkMark.data[i * 4 + 1] = 0x1A; darkMark.data[i * 4 + 2] = 0x1A;
}
fs.writeFileSync(path.join(IMG, 'aabl-logo-dark.png'), encodePNG(darkMark));

// 2) launcher icons — geometric gold "A" monogram on dark tile with gold ring
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy || 1;
  let t = ((px - ax) * dx + (py - ay) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
function drawA(img, color, S, ss) {
  // supersampled coverage for smooth edges
  const cx = S / 2;
  const top = S * 0.30, bot = S * 0.72;
  const half = S * 0.205;         // half base width
  const w = S * 0.083;            // stroke half-thickness
  const barY = bot - (bot - top) * 0.36;
  const apexX = cx, apexY = top;
  const lx = cx - half, rx = cx + half;
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      let cov = 0;
      for (let sy = 0; sy < ss; sy++)
        for (let sx = 0; sx < ss; sx++) {
          const fx = x + (sx + 0.5) / ss, fy = y + (sy + 0.5) / ss;
          const dL = segDist(fx, fy, apexX, apexY, lx, bot);
          const dR = segDist(fx, fy, apexX, apexY, rx, bot);
          const onLeg = dL <= w || dR <= w;
          const onBar = Math.abs(fy - barY) <= w * 0.62 && fx > lx + w && fx < rx - w;
          if ((onLeg || onBar) && fy >= top - w && fy <= bot + w) cov++;
        }
      cov /= ss * ss;
      if (cov <= 0) continue;
      const i = (y * S + x) * 4;
      const a = cov, da = img.data[i + 3] / 255, oa = a + da * (1 - a);
      img.data[i] = (color[0] * a + img.data[i] * da * (1 - a)) / oa;
      img.data[i + 1] = (color[1] * a + img.data[i + 1] * da * (1 - a)) / oa;
      img.data[i + 2] = (color[2] * a + img.data[i + 2] * da * (1 - a)) / oa;
      img.data[i + 3] = oa * 255;
    }
}
const sizes = { 'mipmap-mdpi': 48, 'mipmap-hdpi': 72, 'mipmap-xhdpi': 96, 'mipmap-xxhdpi': 144, 'mipmap-xxxhdpi': 192 };
for (const [dir, S] of Object.entries(sizes)) {
  const d = path.join(RES, dir);
  fs.mkdirSync(d, { recursive: true });
  for (const round of [false, true]) {
    const canvas = newImg(S, S);
    fillShape(canvas, INK, Math.round(S * 0.22), round);
    strokeRing(canvas, GOLD, Math.round(S * 0.09), Math.max(2, Math.round(S * 0.028)), round);
    drawA(canvas, GOLD, S, S <= 72 ? 4 : 3);
    fs.writeFileSync(path.join(d, round ? 'ic_launcher_round.png' : 'ic_launcher.png'), encodePNG(canvas));
  }
  console.log(`wrote ${dir}/ic_launcher(.png/_round.png) @ ${S}px`);
}
console.log('done.');
