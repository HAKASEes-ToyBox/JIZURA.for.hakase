import os
import cv2
import numpy as np
from PIL import Image

image_path = r"C:/Users/jutto/.gemini/antigravity/brain/510693f1-e5ed-48c0-b6f9-d1a76106529e/.user_uploaded/media_1791182488815.jpg"
output_dir = r"C:/Users/jutto/.gemini/antigravity/brain/510693f1-e5ed-48c0-b6f9-d1a76106529e/sprite_cutouts"
os.makedirs(output_dir, exist_ok=True)

# 画像読み込み
img_bgr = cv2.imread(image_path)
h, w = img_bgr.shape[:2]
print(f"Loaded image: {w}x{h}")

# RGBとHSVに変換
img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
img_hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)

# 緑色（グリーンバック）の範囲を定義
# 背景の緑: H はおおよそ 35〜85 あたり, S > 40, V > 40
lower_green = np.array([35, 45, 45])
upper_green = np.array([85, 255, 255])

# 緑色マスク（緑の部分が 255）
green_mask = cv2.inRange(img_hsv, lower_green, upper_green)

# 前景マスク（キャラクター部分が 255、背景が 0）
fg_mask = cv2.bitwise_not(green_mask)

# モルフォロジー処理で微小ノイズ除去と輪郭補正
kernel_small = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
fg_mask_clean = cv2.morphologyEx(fg_mask, cv2.MORPH_OPEN, kernel_small, iterations=1)
# 膨張・収縮でキャラ内の細かい緑ノイズや隙間を埋める
kernel_close = cv2.getStructuringElement(cv2.MORPH_RECT, (7, 7))
fg_mask_closed = cv2.morphologyEx(fg_mask_clean, cv2.MORPH_CLOSE, kernel_close, iterations=2)

# 連結成分分析（4連結）
num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(fg_mask_closed, connectivity=4)
print(f"Total connected components found: {num_labels}")

min_area = (w * h) * 0.005  # 画像全体の0.5%以上の面積を持つものをキャラクター候補とする
char_boxes = []

for i in range(1, num_labels):
    area = stats[i, cv2.CC_STAT_AREA]
    if area < min_area:
        continue
    x = stats[i, cv2.CC_STAT_LEFT]
    y = stats[i, cv2.CC_STAT_TOP]
    bw = stats[i, cv2.CC_STAT_WIDTH]
    bh = stats[i, cv2.CC_STAT_HEIGHT]
    
    # アスペクト比や極端に小さいものをフィルタ
    if bw < 50 or bh < 100:
        continue
    char_boxes.append((x, y, bw, bh, area))

print(f"Characters detected: {len(char_boxes)}")

# 座標順（上段・下段、左から右）にソート
# y座標でおおよそ2段に分類
mid_y = h / 2
top_row = sorted([b for b in char_boxes if b[1] < mid_y * 0.7], key=lambda b: b[0])
bottom_row = sorted([b for b in char_boxes if b[1] >= mid_y * 0.5], key=lambda b: b[0])
sorted_boxes = top_row + bottom_row
print(f"Top row: {len(top_row)}, Bottom row: {len(bottom_row)}")

# 検出枠を描画したプレビュー画像
debug_preview = img_rgb.copy()

cutout_paths = []
# 各キャラクターを透過PNGとして切り出し
for idx, (x, y, bw, bh, area) in enumerate(sorted_boxes):
    pad = 12
    x1 = max(0, x - pad)
    y1 = max(0, y - pad)
    x2 = min(w, x + bw + pad)
    y2 = min(h, y + bh + pad)
    
    # 枠描画
    cv2.rectangle(debug_preview, (x1, y1), (x2, y2), (255, 0, 0), 3)
    cv2.putText(debug_preview, f"#{idx+1}", (x1, y1 + 30), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 0, 0), 2)
    
    # 切り出し領域
    crop_rgb = img_rgb[y1:y2, x1:x2]
    crop_mask = fg_mask[y1:y2, x1:x2]
    
    # エッジのソフト化（簡易アンチエイリアス）
    crop_alpha = cv2.GaussianBlur(crop_mask, (3, 3), 0)
    
    # RGBA画像作成
    rgba = np.dstack((crop_rgb, crop_alpha))
    
    out_file = os.path.join(output_dir, f"character_{idx+1:02d}.png")
    Image.fromarray(rgba).save(out_file)
    cutout_paths.append(out_file)

# 検出結果プレビュー画像の保存
preview_out = r"C:/Users/jutto/.gemini/antigravity/brain/510693f1-e5ed-48c0-b6f9-d1a76106529e/sprite_detection_preview.png"
Image.fromarray(debug_preview).save(preview_out)
print(f"Saved detection preview to: {preview_out}")
print(f"Cut out {len(cutout_paths)} characters successfully!")
