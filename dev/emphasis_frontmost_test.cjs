const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
  try {
    for (const locale of ['', 'en/']) {
      const page = await browser.newPage(), errors = [];
      const url = 'http://127.0.0.1:8765/' + locale;
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => route.request().url() === url
        ? route.fulfill({ contentType: 'text/html', body: fs.readFileSync(path.join(__dirname, '..', locale, 'index.html')) })
        : route.abort());
      await page.goto(url);
      const results = await page.evaluate(() => {
        const project = J.defaultProject();
        project.title = ''; project.durationOverride = 4;
        project.fx = { ...project.fx, koma: 0, chroma: 0, texture: 0, hud: 'off' };
        project.overrides = { 0: { single: true }, 1: { single: true } };
        project.lyricEffects = { ...project.lyricEffects, autoPlacement: false }; // full-stage lyrics: the probe samples the centre
        const element = document.createElement('canvas'); element.width = 320; element.height = 180;
        const x = element.getContext('2d'); x.fillStyle = '#ff0000'; x.fillRect(0, 0, 320, 180);
        const item = { id: 'emphasis-foreground', name: 'red.png', type: 'image', width: 320, height: 180 };
        J.mediaAssets.set(item.id, { element, type: 'image' });
        project.foreground = { ...project.foreground, items: [item], manualCuts: true, cutCount: 1, timing: { lineTimes: { 0: 0 } },
          cutOverrides: { 0: { itemId: item.id, technique: 'none', entrance: 'none', departure: 'none', placement: { cx: .5, cy: .5, w: 1, h: 1, lockAspect: false } } } };
        J.LAYOUTS.__emphasisProbe = { render(env) { env.rect(env.W * .2, env.H * .2, env.W * .6, env.H * .6, '#ffffff'); } };
        const cases = [
          { name: 'strong default', lyrics: '[00:00]*強調表示*', front: true },
          { name: 'strong with saved OFF', lyrics: '[00:00]*強調表示*', override: false, front: true },
          { name: 'normal OFF', lyrics: '[00:00]通常表示', override: false, front: false },
          { name: 'normal ON', lyrics: '[00:00]通常表示', override: true, front: true },
          { name: 'escaped asterisks', lyrics: '[00:00]\\*強調表示\\*', front: false },
          { name: 'retained strong with saved OFF', lyrics: '{\n[00:00]*強調表示*\n[00:01]通常表示\n}', override: false, front: true, time: 1.5 },
        ];
        return cases.map(test => {
          const p = { ...project, lyrics: test.lyrics, lyricCutOptions: test.override == null ? {} : { '0:0': { frontmost: test.override } } };
          const plan = J.plan(p); plan.media = J.planMedia(p, plan); plan.foreground = J.planMedia(p, plan, null, 'foreground');
          plan.events = []; plan.hud = false;
          for (const cut of plan.cuts) Object.assign(cut, { layout: '__emphasisProbe', cam: 'none', decor: [], trans: null, enter: 'cut', exit: 'cut', hold: 'still', groupExit: 'cut', groupOutDur: 0 });
          const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = Math.round(320 * plan.H / plan.W);
          const ctx = canvas.getContext('2d'), renderer = new J.Renderer();
          renderer.frame(ctx, plan, test.time || .5, { scale: 320 / plan.W, noPost: true, noGhost: true, noHud: true });
          return { name: test.name, expected: test.front, frontmost: plan.cuts[0].frontmost,
            pixel: [...ctx.getImageData(160, Math.floor(canvas.height / 2), 1, 1).data] };
        });
      });
      for (const result of results) {
        assert.equal(result.frontmost, result.expected, result.name);
        assert.deepEqual(result.pixel, result.expected ? [255, 255, 255, 255] : [255, 0, 0, 255], result.name + ' rendered layer order');
      }
      assert.deepEqual(errors, []);
      await page.close();
      console.log(`${locale || 'ja/'} emphasis frontmost: passed`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
