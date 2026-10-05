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

        # -----------------------------------------------------------------
        # 検証 1: タイムライン横スクロールの閉じ込め（メイン画面が押し出されない）
        # -----------------------------------------------------------------
        print("=== Step 2: Testing Timeline Horizontal Scroll Containment ===")
        viewport_before = await page.evaluate("""() => {
            const vp = document.getElementById('viewport');
            const rect = vp.getBoundingClientRect();
            return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
        }""")
        print(f"Viewport rect before zoom: left={viewport_before['left']}, width={viewport_before['width']}")

        # ズームを最大（800%）に設定
        await page.evaluate("""() => {
            for (let i = 0; i < 8; i++) {
                document.getElementById('timelineZoomIn').click();
            }
        }""")
        await page.wait_for_timeout(300)
        zoom_max = await page.evaluate("() => J.ui.timelineZoom")
        print(f"Zoom after max ZoomIn: {zoom_max} (8.0 expected)")

        # タイムラインを右端まで横スクロール
        await page.evaluate("""() => {
            const scroll = document.getElementById('timelineScroll');
            scroll.scrollLeft = scroll.scrollWidth;
        }""")
        await page.wait_for_timeout(300)

        # メインプレビュー画面（#viewport）と全体のスクロール状態を確認
        viewport_after = await page.evaluate("""() => {
            const vp = document.getElementById('viewport');
            const rect = vp.getBoundingClientRect();
            return {
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height,
                windowScrollX: window.scrollX,
                bodyScrollLeft: document.documentElement.scrollLeft
            };
        }""")
        print(f"Viewport rect after max scroll: left={viewport_after['left']}, width={viewport_after['width']}")
        print(f"Window scrollX: {viewport_after['windowScrollX']}, body scrollLeft: {viewport_after['bodyScrollLeft']}")

        # メイン画面が1ピクセルも右に押し出されておらず、ブラウザ全体も横スクロールしていないことを検証
        assert abs(viewport_after['left'] - viewport_before['left']) < 1.0, f"Viewport moved! Before: {viewport_before['left']}, After: {viewport_after['left']}"
        assert abs(viewport_after['width'] - viewport_before['width']) < 1.0, f"Viewport width changed! Before: {viewport_before['width']}, After: {viewport_after['width']}"
        assert viewport_after['windowScrollX'] == 0, "Window should not scroll horizontally"
        print("-> [PASS] Timeline scroll is 100% contained within its panel!")

        # -----------------------------------------------------------------
        # 検証 2: 再生中のバー（プレイヘッド）中心のズーム
        # -----------------------------------------------------------------
        print("=== Step 3: Testing Playhead-Anchored Timeline Zoom ===")
        # 一旦ズームを 1.0 (100%) に戻す
        await page.evaluate("""() => {
            J.uiApi.setTimelineZoom(1.0);
            // 再生位置を 3.5 秒に設定
            J.uiApi.seek(3.5);
        }""")
        await page.wait_for_timeout(300)

        # ズーム前における再生バーのスクロール枠内でのオフセットを計算
        playhead_state_1 = await page.evaluate("""() => {
            const scroll = document.getElementById('timelineScroll');
            const stack = document.getElementById('timelineStack');
            const D = Math.max(0.001, J.ui.plan.duration);
            const progress = J.ui.t / D;
            const barX = progress * stack.clientWidth;
            const offsetInView = barX - scroll.scrollLeft;
            return { t: J.ui.t, zoom: J.ui.timelineZoom, barX, scrollLeft: scroll.scrollLeft, offsetInView, clientWidth: scroll.clientWidth };
        }""")
        print(f"Before zoom: t={playhead_state_1['t']}, barX={playhead_state_1['barX']:.1f}, offsetInView={playhead_state_1['offsetInView']:.1f}")

        # Ctrl + Wheel (拡大) を実行
        await page.evaluate("""() => {
            const scroll = document.getElementById('timelineScroll');
            const wheelEv = new WheelEvent('wheel', {
                ctrlKey: true,
                deltaY: -100,
                bubbles: true,
                cancelable: true
            });
            scroll.dispatchEvent(wheelEv);
        }""")
        await page.wait_for_timeout(300)

        playhead_state_2 = await page.evaluate("""() => {
            const scroll = document.getElementById('timelineScroll');
            const stack = document.getElementById('timelineStack');
            const D = Math.max(0.001, J.ui.plan.duration);
            const progress = J.ui.t / D;
            const barX = progress * stack.clientWidth;
            const offsetInView = barX - scroll.scrollLeft;
            return { t: J.ui.t, zoom: J.ui.timelineZoom, barX, scrollLeft: scroll.scrollLeft, offsetInView, clientWidth: scroll.clientWidth };
        }""")
        print(f"After zoom in: t={playhead_state_2['t']}, zoom={playhead_state_2['zoom']}, barX={playhead_state_2['barX']:.1f}, offsetInView={playhead_state_2['offsetInView']:.1f}")
        assert playhead_state_2['zoom'] > 1.0, "Zoom should have increased"
        # 再生バーの見えている位置（offsetInView）が維持されていること（許容誤差 5px以内）
        diff = abs(playhead_state_2['offsetInView'] - playhead_state_1['offsetInView'])
        print(f"Playhead offset diff: {diff:.2f}px")
        assert diff < 5.0, f"Playhead offset changed by {diff}px (expected near 0)"
        print("-> [PASS] Timeline zooms perfectly anchored at the playhead bar!")

        # -----------------------------------------------------------------
        # 検証 3: 演出再抽選時にその演出の開始時点にシーク
        # -----------------------------------------------------------------
        print("=== Step 4: Testing Reroll Seek to Effect Start ===")
        # 歌詞行 2行目 (インデックス 1) の開始時刻を取得
        line_info = await page.evaluate("""() => {
            const line = J.ui.plan.lines[1];
            const cut = J.ui.plan.cuts.find(c => c.line === 1);
            return {
                start: line.start,
                renderStart: cut ? cut.renderStart : line.start
            };
        }""")
        target_start = line_info['renderStart'] if line_info['renderStart'] is not None else line_info['start']
        print(f"Line 2 target start time: {target_start:.3f}s")

        # 再生位置をわざと遠い場所（例: 0.1秒）にしておく
        await page.evaluate("() => J.uiApi.seek(0.1)")
        t_before_reroll = await page.evaluate("() => J.ui.t")
        print(f"Playhead before reroll: {t_before_reroll:.3f}s")

        # 2行目のサイコロボタン（再抽選）をクリック
        await page.evaluate("""() => {
            const lines = document.querySelectorAll('li.lyric-ln:not(.ln-title)');
            if (lines.length > 1) {
                const diceBtn = lines[1].querySelector('.dice');
                if (diceBtn) diceBtn.click();
            }
        }""")
        await page.wait_for_timeout(500)

        t_after_reroll = await page.evaluate("() => J.ui.t")
        expected_time_after = await page.evaluate("""() => {
            const line = J.ui.plan.lines[1];
            const cut = J.ui.plan.cuts.find(c => c.line === 1);
            return cut ? (cut.renderStart ?? cut.start) : line.start;
        }""")
        print(f"Playhead after reroll: {t_after_reroll:.3f}s, Expected: {expected_time_after:.3f}s")
        assert abs(t_after_reroll - expected_time_after) < 0.05, f"Playhead should seek to {expected_time_after}, got {t_after_reroll}"
        print("-> [PASS] Rerolling automatically seeks to the start of the effect!")

        # スクリーンショット保存
        screenshot_path = os.path.join(screenshot_dir, "verified_contained_scroll_and_reroll_seek.png")
        await page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to: {screenshot_path}")

        print(f"Total console errors: {len(console_errors)}")
        assert len(console_errors) == 0, f"Found {len(console_errors)} errors"
        print("=== ALL 3 REQUIREMENTS VERIFIED 100% SUCCESSFULLY! ===")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
