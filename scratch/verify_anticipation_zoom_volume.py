import asyncio, os, time, sys
if sys.stdout.encoding.lower() != 'utf-8':
    try: sys.stdout.reconfigure(encoding='utf-8')
    except Exception: pass
from playwright.async_api import async_playwright

async def main():
    root = r"I:\AntiProject_shaberu\JIZURA"
    root_slash = root.replace("\\", "/")
    index_url = f"file:///{root_slash}/index.html"
    screenshot_dir = r"C:\Users\jutto\.gemini\antigravity\brain\510693f1-e5ed-48c0-b6f9-d1a76106529e"

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1400, "height": 900})
        page = await context.new_page()

        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda err: console_errors.append(str(err)))

        print("=== Step 1: Loading JIZURA ===")
        await page.goto(index_url, wait_until="networkidle")
        await page.wait_for_timeout(1000)

        # 1. 音量バーの存在・動作検証
        print("=== Step 2: Testing Volume Controls ===")
        vol_slider = await page.wait_for_selector("#timelineVolume")
        vol_val = await page.wait_for_selector("#timelineVolumeValue")
        mute_btn = await page.wait_for_selector("#volumeMuteBtn")

        assert vol_slider is not None, "timelineVolume slider not found"
        assert vol_val is not None, "timelineVolumeValue not found"
        assert mute_btn is not None, "volumeMuteBtn not found"

        initial_vol = await vol_val.inner_text()
        print(f"Initial volume text: {initial_vol}")
        assert "100" in initial_vol, f"Expected 100% initial volume, got {initial_vol}"

        # スライダーを 45% に変更
        await page.evaluate("""() => {
            const slider = document.getElementById('timelineVolume');
            slider.value = 45;
            slider.dispatchEvent(new Event('input'));
        }""")
        new_vol_val = await vol_val.inner_text()
        ap_vol = await page.evaluate("() => J.uiAudio ? J.uiAudio.volume : null")
        print(f"Updated volume text: {new_vol_val}, J.uiAudio.volume: {ap_vol}")
        assert "45" in new_vol_val, f"Expected 45%, got {new_vol_val}"
        assert abs(ap_vol - 0.45) < 0.01, f"J.uiAudio.volume mismatch: {ap_vol}"

        # ミュートボタントグル
        await mute_btn.click()
        muted_vol_val = await vol_val.inner_text()
        mute_icon = await mute_btn.inner_text()
        is_muted = await page.evaluate("() => J.uiAudio ? J.uiAudio.muted : null")
        print(f"Muted volume: {muted_vol_val}, icon: {mute_icon}, J.uiAudio.muted: {is_muted}")
        assert "0" in muted_vol_val or is_muted, "Volume should show muted"
        assert is_muted == True, "J.uiAudio.muted should be True"

        # アンミュート
        await mute_btn.click()
        unmuted_val = await vol_val.inner_text()
        is_unmuted = await page.evaluate("() => J.uiAudio ? !J.uiAudio.muted : null")
        print(f"Unmuted volume: {unmuted_val}, J.uiAudio.muted: {await page.evaluate('() => J.uiAudio.muted')}")
        assert is_unmuted == True, "J.uiAudio should be unmuted"
        assert "45" in unmuted_val, f"Volume should restore to 45%, got {unmuted_val}"

        # 2. Ctrl + マウスホイール タイムラインズームの検証
        print("=== Step 3: Testing Ctrl + Wheel Timeline Zoom ===")
        zoom_val = await page.wait_for_selector("#timelineZoomValue")
        initial_zoom = await zoom_val.inner_text()
        print(f"Initial zoom: {initial_zoom}")

        # timelineScroll 上で Ctrl+Wheel (上スクロール = 拡大)
        await page.evaluate("""() => {
            const scroll = document.getElementById('timelineScroll');
            const rect = scroll.getBoundingClientRect();
            const wheelEv = new WheelEvent('wheel', {
                ctrlKey: true,
                deltaY: -100,
                clientX: rect.left + 200,
                clientY: rect.top + 20,
                bubbles: true,
                cancelable: true
            });
            scroll.dispatchEvent(wheelEv);
        }""")
        await page.wait_for_timeout(300)
        zoomed_in_val = await zoom_val.inner_text()
        zoom_level_in = await page.evaluate("() => J.ui.timelineZoom")
        print(f"Zoomed in: {zoomed_in_val}, J.ui.timelineZoom: {zoom_level_in}")
        assert zoom_level_in > 1.0, f"Zoom level should increase, got {zoom_level_in}"

        # Ctrl+Wheel (下スクロール = 縮小)
        await page.evaluate("""() => {
            const scroll = document.getElementById('timelineScroll');
            const rect = scroll.getBoundingClientRect();
            const wheelEv = new WheelEvent('wheel', {
                ctrlKey: true,
                deltaY: 100,
                clientX: rect.left + 200,
                clientY: rect.top + 20,
                bubbles: true,
                cancelable: true
            });
            scroll.dispatchEvent(wheelEv);
        }""")
        await page.wait_for_timeout(300)
        zoom_level_out = await page.evaluate("() => J.ui.timelineZoom")
        print(f"Zoomed out, J.ui.timelineZoom: {zoom_level_out}")

        # 3. 先行着地補正（案A）＆ 予兆表示（案B）の検証
        print("=== Step 4: Testing Anticipation (Plan A) & Ghost Pre-roll (Plan B) ===")
        cuts_data = await page.evaluate("""() => {
            return J.ui.plan.cuts.filter(c => !c.blank).map(c => ({
                index: c.index,
                text: c.text,
                start: c.start,
                renderStart: c.renderStart,
                leadTime: c.leadTime,
                inDur: c.inDur
            }));
        }""")
        print(f"Total active cuts checked: {len(cuts_data)}")
        for c in cuts_data[:8]:
            print(f"  Cut #{c['index']}: start={c['start']:.2f}, renderStart={c['renderStart']:.2f}, leadTime={c['leadTime']:.2f}, inDur={c['inDur']:.2f}")
            assert c['renderStart'] <= c['start'], f"renderStart should be <= start"
            assert c['leadTime'] >= 0, f"leadTime should be >= 0"
        
        has_lead = any(c['leadTime'] > 0 for c in cuts_data)
        assert has_lead, "At least one cut should have leadTime > 0"

        # 予兆表示トグルの検証
        ghost_toggle = await page.wait_for_selector("#showGhostPreRoll")
        assert ghost_toggle is not None, "showGhostPreRoll toggle not found"
        initial_ghost = await page.evaluate("() => document.getElementById('showGhostPreRoll').checked")
        print(f"Initial ghostPreRoll checked: {initial_ghost}")

        # トグルをONにする
        await ghost_toggle.check()
        ghost_checked = await page.evaluate("() => document.getElementById('showGhostPreRoll').checked && J.ui.project.ghostPreRoll && J.ui.plan.ghostPreRoll")
        print(f"After checking ghost toggle, J.ui.plan.ghostPreRoll: {ghost_checked}")
        assert ghost_checked == True, "ghostPreRoll should be enabled in project and plan"

        # レンダリング＆シークテスト (先行期間中 t = cut.renderStart + leadTime * 0.5)
        test_cut = cuts_data[1] if len(cuts_data) > 1 else cuts_data[0]
        seek_t = test_cut['renderStart'] + test_cut['leadTime'] * 0.5
        print(f"Seeking to pre-roll anticipation time: {seek_t:.3f}s (cut start: {test_cut['start']:.3f}s)")
        await page.evaluate(f"t => {{ J.ui.t = t; J.ui.need = true; }}", seek_t)
        await page.wait_for_timeout(500)

        # スクリーンショット取得
        screenshot_path = os.path.join(screenshot_dir, "verified_features_ui.png")
        await page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to: {screenshot_path}")

        # コンソールエラーの確認
        print(f"Console errors during test: {len(console_errors)}")
        if console_errors:
            print("Errors:", console_errors)
        assert len(console_errors) == 0, f"Found {len(console_errors)} console errors"

        print("=== ALL TESTS PASSED! ===")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
