/** Colour values in CSS or HTML text, normalised to lower-case #rrggbb (or #rrggbbaa when not opaque). */
export function colorsIn(text: string): string[] {
  const found: string[] = [];
  const pattern = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g;
  for (const match of text.matchAll(pattern)) {
    const color = normalizeColor(match[0]);
    if (color) found.push(color);
  }
  return found;
}

export function normalizeColor(value: string): string | null {
  const v = value.trim().toLowerCase();
  if (v.startsWith('#')) {
    const hex = v.slice(1);
    if (![3, 4, 6, 8].includes(hex.length) || !/^[0-9a-f]+$/.test(hex)) return null;
    const full = hex.length <= 4 ? [...hex].map((c) => c + c).join('') : hex;
    return `#${full.endsWith('ff') && full.length === 8 ? full.slice(0, 6) : full}`;
  }
  const args = /^(rgba?|hsla?)\(([^)]*)\)$/.exec(v);
  if (!args) return null;
  const parts = args[2]!.split(/[\s,/]+/).filter(Boolean);
  if (parts.length < 3) return null;
  const alpha = parts[3] === undefined ? 1 : parseAlpha(parts[3]);
  let rgb: number[];
  if (args[1]!.startsWith('rgb')) {
    rgb = parts.slice(0, 3).map((p) => (p.endsWith('%') ? (parseFloat(p) * 255) / 100 : parseFloat(p)));
  } else {
    const h = parseFloat(parts[0]!);
    const s = parseFloat(parts[1]!) / 100;
    const l = parseFloat(parts[2]!) / 100;
    rgb = hslToRgb(h, s, l);
  }
  if (rgb.some((n) => Number.isNaN(n)) || Number.isNaN(alpha)) return null;
  const hex = rgb
    .map((n) =>
      Math.round(Math.min(255, Math.max(0, n)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');
  return alpha >= 1
    ? `#${hex}`
    : `#${hex}${Math.round(alpha * 255)
        .toString(16)
        .padStart(2, '0')}`;
}

function parseAlpha(value: string): number {
  return value.endsWith('%') ? parseFloat(value) / 100 : parseFloat(value);
}

function hslToRgb(h: number, s: number, l: number): number[] {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}
