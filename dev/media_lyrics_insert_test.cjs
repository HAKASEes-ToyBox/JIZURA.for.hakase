const {chromium} = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
  try {
    for (const locale of ['', 'en/']) {
      const page = await browser.newPage({viewport:{width:1500,height:1000}}), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto('http://127.0.0.1:8765/' + locale);
      await page.locator('#modePro').click();
      const insert = page.locator('#btnMediaFromLyrics');
      const modeSelect = page.locator('#mediaLyricInsertMode');
      assert.equal(await page.locator('#mediaCutCount, #mediaCutCountField').count(), 0);
      assert.equal(await insert.isVisible(), false, 'lyrics tab must not show the media action');
      for (const layer of ['foreground','media']) {
        await page.locator(layer === 'media' ? '#sourceMedia' : '#sourceForeground').click();
        assert.equal(await modeSelect.inputValue(), 'line', 'old projects default to line alignment');
        assert.equal(await insert.isDisabled(), true, 'files are required');
        await page.locator('#mediaFiles').setInputFiles(['circle','square'].map((name,i) => ({
          name:name + '.svg',mimeType:'image/svg+xml',
          buffer:Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90">${i ? '<rect x="45" y="10" width="70" height="70" fill="coral"/>' : '<circle cx="80" cy="45" r="35" fill="cyan"/>'}</svg>`),
        })));
        await page.waitForFunction(layer => J.ui.project[layer].items.length === 2, layer);
      }
      const fixture = await page.evaluate(() => {
        const p = structuredClone(J.ui.project);
        p.lyrics = '[00:01.125]夜明けの空/遠くへ続く\n[00:04.250]風が吹く/声を運ぶ\n[00:08.375]白い雲/空に浮かぶ\n[00:22.500]街を抜け/海へ向かう\n[00:32.625]波の音/今日も響く';
        p.title = 'Title card'; p.fps = 30;
        p.lyricBlankCuts = [{id:'blank-test',beforeLine:2,start:7}];
        p.fx.density = 1;
        return p;
      });
      await page.locator('#fileProject').setInputFiles({name:'fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});
      await page.waitForFunction(() => J.ui.plan.lines.length === 5);
      assert.equal(await page.evaluate(() => J.ui.plan.cuts.some(c => c.part === 1) && J.ui.plan.cuts.some(c => c.manualEnd && Math.abs(c.end - 7) < 1e-6) && J.ui.plan.cuts.some(c => c.line === -1)), true);
      const project = () => page.evaluate(() => structuredClone(J.ui.project));
      const lyricTargets = mode => page.evaluate(mode => J.ui.plan.cuts
        .filter(c => mode === 'cut' ? c.line >= 0 : c.line >= 0 && c.part === 0)
        .map(c => ({start:c.start,ref:`l:${c.line}:${c.part}`})), mode);

      for (const mode of ['cut','line']) {
        for (const layer of ['foreground','media']) {
          await page.locator(layer === 'media' ? '#sourceMedia' : '#sourceForeground').click();
          assert.equal(await insert.innerText(), locale ? 'Insert cuts aligned to lyrics' : '歌詞に合わせて一括挿入');
          assert.deepEqual(await modeSelect.locator('option').allTextContents(), locale ? ['Lyric lines','Lyric cuts'] : ['行に合わせる','カットに合わせる']);
          const previousCuts = await page.evaluate(layer => J.ui.plan[layer].cuts.map(c => c.start), layer);
          const otherMode = (await project())[layer === 'media' ? 'foreground' : 'media'].lyricInsertMode;
          await modeSelect.selectOption(mode);
          assert.deepEqual(await page.evaluate(layer => J.ui.plan[layer].cuts.map(c => c.start), layer), previousCuts, 'selecting a mode alone must not replace cuts');
          assert.equal((await project())[layer === 'media' ? 'foreground' : 'media'].lyricInsertMode, otherMode);
          for (const loop of [false,true]) for (const random of [false,true]) {
            await page.locator('#mediaLoop').setChecked(loop);
            await page.locator('#mediaRandom').setChecked(random);
            await page.locator('#mediaLineList .media-technique').first().selectOption('pushIn');
            await page.locator('#mediaLineList .lock').first().click();
            const before = await project();
            const expectedTargets = await lyricTargets(mode);
            await insert.click();
            const after = await project();
            const report = await page.evaluate(layer => {
              const p = J.ui.project, cuts = J.ui.plan[layer].cuts;
              const order = J.mediaOrder(p, layer);
              return {cuts:cuts.map((c,i) => ({
                start:c.start,id:c.itemId,expectedId:order[i % order.length].id,
                ref:(layer === 'media' ? 'm:' : 'f:') + i,
              })),links:p.timelineLinks};
            }, layer);
            assert.equal(report.cuts.length, loop ? expectedTargets.length : Math.min(2,expectedTargets.length));
            assert.deepEqual(await lyricTargets(mode), expectedTargets, 'insertion must not move lyric boundaries');
            for (const [i,cut] of report.cuts.entries()) {
              assert.equal(cut.start, expectedTargets[i].start, 'fractional-frame start time must be copied exactly');
              assert.equal(cut.id, cut.expectedId);
              assert.ok(report.links.some(link => link.a === cut.ref && link.b === expectedTargets[i].ref));
            }
            const other = layer === 'media' ? 'foreground' : 'media', prefix = layer === 'media' ? 'm:' : 'f:';
            assert.deepEqual(after[other], before[other], 'the other layer settings must be preserved');
            if (mode === 'line') assert.deepEqual(after.timing, before.timing, 'line mode must not add lyric timing overrides');
            const otherLinks = links => links.filter(link => !link.a.startsWith(prefix) && !link.b.startsWith(prefix));
            assert.deepEqual(otherLinks(after.timelineLinks), otherLinks(before.timelineLinks));
            await page.locator('#btnUndo').click();
            assert.deepEqual(await project(), before, 'one Undo restores cuts and links');
            await page.locator('#btnRedo').click();
            assert.deepEqual(await project(), after);
            await insert.click();
            assert.deepEqual(await project(), after, 'repeating the action must not duplicate cuts or links');
          }
        }
        if (mode === 'cut') {
          const targets = await lyricTargets(mode);
          assert.ok(targets.length > 5);
          assert.ok(!targets.some(c => c.ref.startsWith('l:blank:')));
          assert.ok(targets.some(c => c.ref.endsWith(':interlude')));
          assert.equal(await page.locator('#timelineLinks .link-wire').count(), targets.length * 2);
          // Move an inner cut, then a line start: every linked boundary must remain aligned.
          for (const ref of ['l:0:1','l:1:0']) {
            const target = (await lyricTargets(mode)).find(c => c.ref === ref);
            const duration = await page.evaluate(() => J.ui.plan.duration);
            const rect = await page.locator('#mediaTimeline').boundingBox(), y = rect.y + rect.height - 8;
            await page.mouse.move(rect.x + target.start / duration * rect.width, y);
            await page.mouse.down();
            await page.mouse.move(rect.x + (target.start + .3) / duration * rect.width, y, {steps:8});
            await page.mouse.up();
            const moved = await lyricTargets(mode);
            assert.ok(moved.find(c => c.ref === ref).start > target.start + .1);
            for (const layer of ['foreground','media']) {
              const actual = await page.evaluate(layer => J.ui.plan[layer].cuts.map(c => c.start), layer);
              assert.deepEqual(actual, moved.map(c => c.start), 'cut links must stay aligned after dragging');
            }
          }
        }
      }
      assert.equal(await page.locator('#timelineLinks .link-wire').count(), 10, 'both layers link to five lyric line starts');
      // Drag one background boundary and check the entire three-layer group moves.
      const timing = await page.evaluate(() => ({start:J.ui.plan.media.cuts[1].start,duration:J.ui.plan.duration}));
      const box = await page.locator('#mediaTimeline').boundingBox(), y = box.y + box.height - 8;
      await page.mouse.move(box.x + timing.start / timing.duration * box.width, y);
      await page.mouse.down();
      await page.mouse.move(box.x + (timing.start + .5) / timing.duration * box.width, y, {steps:8});
      await page.mouse.up();
      const starts = await page.evaluate(() => [J.ui.plan.media.cuts[1].start,J.ui.plan.foreground.cuts[1].start,J.ui.plan.lines[1].start]);
      assert.ok(starts[0] > timing.start + .2, 'boundary drag must move');
      assert.equal(starts[0], starts[1]); assert.equal(starts[0], starts[2]);
      // Existing unlink controls and structural edits must work on the new links.
      const linked = await project();
      await page.locator('#timelineLinks .link-remove').first().click();
      assert.equal((await project()).timelineLinks.length, linked.timelineLinks.length - 1);
      await page.locator('#btnUndo').click();
      assert.deepEqual((await project()).timelineLinks, linked.timelineLinks);
      await page.locator('#mediaLineList .media-cut-insert button').first().click();
      assert.ok((await project()).timelineLinks.some(link => link.a === 'm:1' && link.b === 'l:0:0'));
      await page.locator('#btnUndo').click();
      assert.deepEqual(await project(), linked);
      await page.locator('#sourceForeground').click();
      await modeSelect.selectOption('cut');
      const saved = await project();
      await page.evaluate(() => J.uiApi.flushSave());
      await page.reload();
      await page.waitForFunction(() => J.mediaAssets.size === 4);
      assert.deepEqual(await project(), saved, 'cuts, links and alignment preferences must survive reload');
      await page.locator('#sourceForeground').click();
      assert.equal(await modeSelect.inputValue(), 'cut');
      await page.locator('#sourceMedia').click();
      assert.equal(await modeSelect.inputValue(), 'line');
      await page.locator('#btnMediaFromLyrics').scrollIntoViewIfNeeded();
      await page.screenshot({path:`../media-lyrics-insert-${locale ? 'en' : 'ja'}.png`,fullPage:true});
      await page.locator('#sourceLyrics').click();
      await page.locator('#lyrics').fill('');
      await page.waitForFunction(() => J.ui.plan.lines.length === 0);
      await page.locator('#sourceMedia').click();
      assert.equal(await insert.isDisabled(), true, 'lyrics are required');
      assert.deepEqual(errors, []);
      console.log(locale || 'ja', 'line/cut insertion, loop/random order, three-layer links, undo and reload: OK');
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(e => {console.error(e);process.exit(1);});
