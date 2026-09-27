/* Colour themes (テーマ設定 → カラー): a colour genre and one theme colour steer every random palette.
   They take priority over the colours implied by music-genre / taste themes. */
(() => {
'use strict';
const L = J.mediaLabel, wrap = h => ((h % 360) + 360) % 360;
const range = (rnd, [a, b]) => a + (b - a) * rnd();
const pickOf = (rnd, list) => list[Math.floor(rnd() * list.length)];
// bg(h, rnd): background (null keeps the style's own); acc / ghost: [sat range, dark-bg lightness, light-bg lightness];
// hues: preferred hue ranges when no theme colour is given.
J.COLOR_GENRES = {
  auto: { name: L('指定なし', 'Not specified'), description: L('スタイルの背景のまま、アクセントとズレ色を選びます', "Keeps the style's background; picks accent and offset colours"),
    bg: null, acc: [[.82, 1], [.52, .62], [.44, .52]], ghost: [[.82, 1], [.52, .62], [.44, .52]] },
  vivid: { name: L('ビビッド', 'Vivid'), description: L('鮮やかな原色系', 'Saturated, bold colours'),
    bg: (h, r) => r() < .65 ? J.hsl(h, .3, .07) : J.hsl(h, .12, .97), acc: [[.9, 1], [.5, .58], [.45, .52]], ghost: [[.9, 1], [.5, .6], [.46, .54]] },
  pastel: { name: L('パステル', 'Pastel'), description: L('淡く明るい背景とやわらかい色', 'Light, soft colours'),
    bg: (h, r) => J.hsl(h + range(r, [-25, 25]), .55, .93), acc: [[.5, .7], [.72, .8], [.62, .7]], ghost: [[.45, .65], [.75, .82], [.62, .7]] },
  neon: { name: L('ネオン', 'Neon'), description: L('暗い背景に発光するような蛍光色', 'Glowing colours on black'),
    bg: (h, r) => J.hsl(h + 180, .4, .04), acc: [[1, 1], [.55, .62], [.5, .56]], ghost: [[1, 1], [.55, .62], [.5, .56]] },
  dark: { name: L('ダーク', 'Dark'), description: L('深い背景と落ち着いた色', 'Deep backgrounds, muted colours'),
    bg: (h, r) => J.hsl(h, .22, .08), acc: [[.4, .6], [.52, .62], [.4, .5]], ghost: [[.35, .5], [.4, .52], [.4, .5]] },
  mono: { name: L('モノトーン', 'Monotone'), description: L('白黒とグレー（テーマカラーのみ色付き）', 'Black, white and grey (only the theme colour is coloured)'),
    bg: (h, r) => r() < .5 ? '#0E0E0E' : '#F2F2F2', acc: [[0, 0], [.78, .86], [.24, .32]], ghost: [[0, 0], [.5, .6], [.5, .6]] },
  earth: { name: L('アース', 'Earth'), description: L('土や草木のような落ち着いた暖色', 'Earthy browns, ochres and greens'),
    bg: (h, r) => r() < .6 ? J.hsl(38, .3, .88) : J.hsl(25, .25, .1), acc: [[.35, .55], [.55, .64], [.38, .5]], ghost: [[.3, .5], [.5, .6], [.45, .55]], hues: [[18, 48], [80, 130]] },
  retro: { name: L('レトロ', 'Retro'), description: L('クリーム地にくすんだ赤・青緑・からし色', 'Cream with faded red, teal and mustard'),
    bg: (h, r) => r() < .75 ? J.hsl(42, .5, .87) : J.hsl(200, .3, .12), acc: [[.5, .65], [.55, .63], [.44, .54]], ghost: [[.45, .6], [.55, .63], [.5, .58]], hues: [[2, 12], [38, 48], [170, 190], [345, 355]] },
  cool: { name: L('クール', 'Cool'), description: L('青・水色・紫系の寒色', 'Blues, cyans and violets'),
    bg: (h, r) => r() < .7 ? J.hsl(220, .45, .09) : J.hsl(205, .35, .95), acc: [[.6, .85], [.52, .62], [.44, .52]], ghost: [[.55, .8], [.5, .6], [.46, .54]], hues: [[170, 265]] },
};
J.COLOR_GENRE_ORDER = Object.keys(J.COLOR_GENRES);
J.normalizeColorTheme = t => ({
  genre: J.COLOR_GENRES[t?.genre] ? t.genre : 'auto',
  color: /^#[0-9a-f]{6}$/i.test(t?.color || '') ? t.color.toUpperCase() : null,
});
J.colorThemeActive = project => { const t = J.normalizeColorTheme(project?.colorTheme); return t.genre !== 'auto' || !!t.color; };
// Harmonies around the key hue: complementary, split complementary, triadic, analogous.
const HARMONIES = [[180, 150], [150, 210], [120, 240], [30, -30], [200, 160]];
// current: the colours being replaced (their base colours stay when the genre keeps the style background).
J.themedPalette = (project, styleKey, rnd = Math.random, current = project.colors) => {
  const theme = J.normalizeColorTheme(project.colorTheme), G = J.COLOR_GENRES[theme.genre];
  const key = theme.color ? J.toHsl(theme.color) : null;
  const hueOf = () => G.hues ? wrap(range(rnd, pickOf(rnd, G.hues))) : rnd() * 360;
  const h0 = key ? key[0] : hueOf();
  const styleBg = current?.enabled && current.bg ? current.bg : (J.STYLES[styleKey] || J.STYLES.noir).schemes[0].bg;
  const bg = G.bg ? G.bg(h0, rnd).toUpperCase() : styleBg, dark = J.lum(bg) < .5;
  const tone = ([s, ld, ll], h) => J.hsl(wrap(h), range(rnd, s), range(rnd, dark ? ld : ll));
  // With a genre hue set, the second colours stay in it; otherwise they follow the harmony.
  const [o1, o2] = pickOf(rnd, HARMONIES), second = o => G.hues && !key ? hueOf() : h0 + o;
  const accent = J.fitContrast(key ? theme.color : tone(G.acc, h0), bg, 2.4);
  const ghostA = J.fitContrast(tone(G.ghost, second(o1)), bg, 1.35), ghostB = J.fitContrast(tone(G.ghost, second(o2)), bg, 1.35);
  const accent2 = J.fitContrast(tone(G.acc, second(o1)), bg, 2.4);
  const colors = { accentOn: true, accent, accent2, ghostA, ghostB };
  if (G.bg) {
    // Text colours lean slightly towards the key hue; contrast keeps them readable.
    const fg = J.fitContrast(J.hsl(h0, dark ? .12 : .25, dark ? .95 : .12), bg, 7);
    Object.assign(colors, { enabled: true, allSchemes: true, bg, fg, sub: J.fitContrast(J.mix(fg, bg, .4), bg, 3.5), dim: J.mix(bg, fg, .14) });
  }
  return colors;
};
// Colours with the theme palette applied to `current`: accent colours always, base colours when the genre
// sets a background (otherwise the current base colours, manual or not, are kept).
J.themedColors = (project, styleKey, rnd, current = project.colors) => {
  const palette = J.themedPalette(project, styleKey, rnd, current), colors = { ...(current || {}) };
  for (const key of ['accent', 'accent2', 'ghostA', 'ghostB', ...(palette.enabled ? ['bg', 'fg', 'sub', 'dim', 'allSchemes'] : [])]) delete colors[key];
  return Object.assign(colors, palette);
};
const omakase = J.omakase;
J.omakase = (project, rnd = Math.random, choices = {}) => {
  const look = omakase(project, rnd, choices);
  if (J.colorThemeActive(project)) look.colors = J.themedColors(project, look.style, rnd, look.colors);
  return look;
};
})();
