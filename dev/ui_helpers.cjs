// The settings drawer (かんたん / 詳細) is a fixed overlay on the right edge. While it is open it covers
// the right side of the preview, transport and timeline at every viewport width, so tests keep it closed
// and open it only while they operate controls inside it.
async function openSettings(page, mode = 'pro') {
  const drawer = page.locator('#settingsDrawer');
  const current = await page.evaluate(() => J.ui.mode);
  if (await drawer.isVisible() && current === mode) return;
  if (await drawer.isVisible()) await closeSettings(page);
  await page.locator(mode === 'easy' ? '#modeEasy' : '#modePro').click();
  await drawer.waitFor({state: 'visible'});
}
async function closeSettings(page) {
  const drawer = page.locator('#settingsDrawer');
  if (!await drawer.isVisible()) return;
  await page.locator('#closeSettingsDrawer').click();
  await drawer.waitFor({state: 'hidden'});
}
// Switch to 詳細 (pro) mode and leave the drawer closed. Also installs guardDrawer.
async function proMode(page) {
  guardDrawer(page);
  await openSettings(page, 'pro');
  await closeSettings(page);
}
// From then on, every user-like action (click, fill, selectOption, …) first opens the drawer when its
// target is inside it and closes it when the target is elsewhere on the page, like a person would.
// Targets in dialogs, the drawer rail and the drawer's own buttons are left alone.
const ACTIONS = ['click', 'dblclick', 'tap', 'fill', 'check', 'uncheck', 'setChecked', 'selectOption', 'setInputFiles', 'press', 'type', 'pressSequentially', 'hover'];
let guarded = false;
function guardDrawer(page) {
  if (guarded) return;
  guarded = true;
  const proto = Object.getPrototypeOf(page.locator('body'));
  for (const name of ACTIONS) {
    const original = proto[name];
    if (typeof original !== 'function') continue;
    proto[name] = async function (...args) {
      const where = await this.evaluate(el => el.closest('dialog,.settings-rail,.settings-drawer-heading,#timelineCutMenu') ? 'skip' : el.closest('#settingsDrawer') ? 'drawer' : 'page').catch(() => 'skip');
      const target = this.page();
      if (where !== 'skip' && await target.evaluate(() => !!window.J?.ui).catch(() => false)) {
        if (where === 'drawer') await openSettings(target, await target.evaluate(() => J.ui.mode));
        else await closeSettings(target);
      }
      return original.apply(this, args);
    };
  }
}
// On compact screens the source panel (前景 / 歌詞・曲 / 背景) is a drawer on the left edge too.
const SOURCE_TABS = {foreground: '#sourceForeground', lyrics: '#sourceLyrics', media: '#sourceMedia'};
async function openSource(page, tab = 'lyrics') {
  const state = await page.evaluate(() => ({compact: document.getElementById('app').classList.contains('compact-ui'), open: !!J.ui.sourceOpen, tab: J.ui.sourceTab}));
  if (!state.compact) { if (state.tab !== tab) await page.locator(SOURCE_TABS[tab]).click(); return; }
  if (state.open && state.tab === tab) return;
  await closeSettings(page);
  await page.locator(SOURCE_TABS[tab]).click();
  await page.waitForFunction(() => J.ui.sourceOpen);
}
async function closeSource(page) {
  if (!await page.evaluate(() => document.getElementById('app').classList.contains('compact-ui') && !!J.ui.sourceOpen)) return;
  await page.locator('#closeSourceDrawer').click();
  await page.waitForFunction(() => !J.ui.sourceOpen);
}
// Timeline cut actions live in a per-cut ☰ menu: open the menu of the first cut matching `filter`
// (attribute selectors such as '[data-layer="lyrics"][data-index="1"]'), then choose `action`.
// The menu closes on any scroll, so a scroll still settling (e.g. right after panning the timeline) can
// close it again at once: retry opening it a few times.
async function timelineAction(page, filter, action) {
  const item = page.locator(`#timelineCutMenu [data-action="${action}"]`);
  for (let attempt = 0; ; attempt++) {
    if (!await item.isVisible()) await page.locator(`#timelineLinks .timeline-action${filter}`).first().dispatchEvent('pointerdown', {button: 0});
    try { await item.click({timeout: 1500}); return; } catch (e) { if (attempt >= 2) throw e; await page.waitForTimeout(300); }
  }
}
module.exports = {openSettings, closeSettings, proMode, guardDrawer, openSource, closeSource, timelineAction};
