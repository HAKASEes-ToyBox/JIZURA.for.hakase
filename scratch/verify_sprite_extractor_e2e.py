import asyncio
import os
import json
from playwright.async_api import async_playwright

async def main():
    root = r"I:/AntiProject_shaberu/JIZURA"
    test_image_path = r"C:/Users/jutto/.gemini/antigravity/brain/510693f1-e5ed-48c0-b6f9-d1a76106529e/.user_uploaded/media_1791182488815.jpg"
    screenshot_dir = r"C:/Users/jutto/.gemini/antigravity/brain/510693f1-e5ed-48c0-b6f9-d1a76106529e"

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1400, "height": 900})
        page = await context.new_page()

        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda err: console_errors.append(str(err)))

        print("=== Step 1: Loading JIZURA ===")
        await page.goto(f"file:///{root}/index.html")
        await page.wait_for_selector("#app")
        await page.wait_for_timeout(1000)

        print("=== Step 2: Navigating to Foreground tab and opening Sprite Extractor ===")
        # 前景タブをクリック
        await page.click("#sourceForeground")
        await page.wait_for_timeout(300)

        # 切り出しボタンが存在することを確認
        btn_extract = await page.wait_for_selector("#btnSpriteExtract")
        assert btn_extract is not None, "Button #btnSpriteExtract not found!"
        print("-> [PASS] #btnSpriteExtract button found in Foreground tab")

        # ボタンをクリックしてモーダルを開く
        await btn_extract.click()
        await page.wait_for_timeout(300)

        dlg = await page.wait_for_selector("#spriteExtractDlg[open]")
        assert dlg is not None, "Dialog #spriteExtractDlg is not open!"
        print("-> [PASS] #spriteExtractDlg opened successfully")

        print("=== Step 3: Uploading Sprite Sheet Image ===")
        file_input = await page.wait_for_selector("#seFileInput", state="attached")
        await file_input.set_input_files(test_image_path)
        await page.wait_for_timeout(2000)

        # 検出結果の件数を確認
        count_text = await page.inner_text("#seCount")
        print(f"Detected character count (CCL): {count_text}")
        assert int(count_text) >= 8, f"Expected at least 8-10 characters, got {count_text}"

        thumbs = await page.query_selector_all(".se-thumb")
        print(f"Rendered thumbnails count: {len(thumbs)}")
        assert len(thumbs) >= 8, f"Expected thumbnail elements, got {len(thumbs)}"
        print("-> [PASS] Auto-detection (CCL) detected characters and rendered thumbs!")

        # モーダルが開いた状態のスクリーンショット
        modal_shot = os.path.join(screenshot_dir, "sprite_extractor_modal_verified.png")
        await page.screenshot(path=modal_shot)
        print(f"Modal screenshot saved to: {modal_shot}")

        print("=== Step 4: Testing Grid Mode (2 rows x 5 cols) ===")
        # グリッドモードを選択
        await page.click("input[name='seMode'][value='grid']")
        await page.wait_for_timeout(500)
        grid_count = await page.inner_text("#seCount")
        print(f"Grid mode detected count: {grid_count}")
        assert int(grid_count) == 10, f"Expected exactly 10 in 2x5 grid mode, got {grid_count}"
        print("-> [PASS] Grid mode (2x5) produced exactly 10 character blocks!")

        print("=== Step 5: Batch Registering Characters to Foreground Layer ===")
        # 登録先が前景であることを確認
        target_val = await page.eval_on_selector("#seTargetLayer", "el => el.value")
        print(f"Target layer selected: {target_val}")
        assert target_val == "foreground", f"Expected foreground, got {target_val}"

        # 一括登録ボタンをクリック
        btn_register = await page.wait_for_selector("#seBtnRegister")
        await btn_register.click()
        await page.wait_for_timeout(1500)

        # モーダルが閉じたことを確認
        is_open = await page.eval_on_selector("#spriteExtractDlg", "el => el.hasAttribute('open')")
        assert not is_open, "Dialog should be closed after registration"
        print("-> [PASS] Dialog closed after registration")

        # JIZURA の S.project.foreground.items に素材が追加されたことを検証
        fg_items = await page.evaluate("() => J.ui.project.foreground.items")
        print(f"Foreground items count in project: {len(fg_items)}")
        assert len(fg_items) == 10, f"Expected 10 items in foreground, got {len(fg_items)}"

        # 各アイテムが J.mediaAssets に登録され、element が存在することを検証
        asset_check = await page.evaluate("""() => {
            const items = J.ui.project.foreground.items;
            return items.map(it => ({
                id: it.id,
                name: it.name,
                hasAsset: J.mediaAssets.has(it.id),
                hasElement: !!(J.mediaAssets.get(it.id)?.element)
            }));
        }""")
        for a in asset_check:
            assert a["hasAsset"], f"Asset not registered in J.mediaAssets: {a['name']}"
            assert a["hasElement"], f"Asset element not loaded: {a['name']}"
        print("-> [PASS] All 10 character assets exist in project and J.mediaAssets!")

        # メディアリストにサムネイルが表示されていることを確認
        media_list_items = await page.query_selector_all("#mediaList .media-item")
        print(f"Media list rendered elements: {len(media_list_items)}")
        assert len(media_list_items) == 10, f"Expected 10 media list elements, got {len(media_list_items)}"

        # 登録完了後のメイン画面のスクリーンショット
        main_shot = os.path.join(screenshot_dir, "sprite_extracted_foreground_verified.png")
        await page.screenshot(path=main_shot)
        print(f"Main view screenshot saved to: {main_shot}")

        print(f"Total console errors: {len(console_errors)}")
        if console_errors:
            print("Errors:", console_errors)
        assert len(console_errors) == 0, f"Found {len(console_errors)} errors"

        print("=== ALL SPRITE EXTRACTOR E2E TESTS PASSED 100%! ===")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
