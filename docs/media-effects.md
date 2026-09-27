# 前景・背景の演出 / Media effects

前景・背景の各カットで、手法・登場・退場を独立して選択します。登場・退場の初期値は「自動」です。

- **演出無し**：保持中のモーション・加工を付けません。完全な即時表示にするには、登場・退場も「即時（なし）」にします。動画そのものの再生は続きます。
- **自動**：詳細 → 前景 / 背景で、それぞれ有効にした手法から選びます。
- **手法名**：保持中のモーション・加工・つなぎを固定します。登場・退場は別々に指定できます。

登場55種類・退場55種類と、保持中の手法146種類（つなぎ・歌詞カメラを含む）を選べます。詳細のカテゴリは「登場」「退場」「カメラ」「ダイナミックモーション」「BPM同期」「色・質感」「分割・残像・グリッチ」「カット間のつなぎ」です。旧マスク・出現カテゴリと登場向けの演出は登場・退場へ整理しました。各「自動」は対応するカテゴリの有効な候補だけから選び、候補がない場合は即時表示になります。詳細タブでは、動きの強さ、加工の強さ、登場・退場の秒数と、自動選定に含める手法を設定できます。詳細の「前景」「背景」タブでそれぞれ個別に設定できます。自動配置のオン・オフも別々に指定できます。以前の共通設定は両レイヤーへ引き継ぎます。

各手法の▶で開く演出プレビューには、動きの強さ・加工の強さ・登場・退場時間のスライダーがあります。初期値は詳細の現在値で、変更はプレビューだけに反映されます（プロジェクトは変わりません）。プレビューの下には再生位置を示すシークバー（表示のみ）があります。登場のプレビューは、登場が終わって約1秒後に繰り返します。

詳細の各カテゴリは見出しをクリックして折り畳み・展開できます。見出しには有効な手法数／総数を表示し、カテゴリごとに「すべてON」「すべてOFF」「反転」でまとめて変更できます。

「おまかせ」は前景・背景それぞれの手法チェックを独立にランダム設定します。動き・加工の強さ、登場・退場時間、自動配置の設定は保持します。変更したチェックは「元に戻す／やり直す」「前の案／次の案」やプロジェクト保存に対応します。

各タブの「前景をシャッフル」「背景をシャッフル」は対象のレイヤーだけを再抽選します。通常のシャッフルは両レイヤーの自動の素材カットを再抽選します。シャッフルでは手法チェックを保持します。明示的に選んだ手法・演出無し・ロックしたカットは維持されます。各カットのサイコロは、そのカットを自動へ切り替えて再抽選します。

「ランダム順で表示」は、素材が2つ以上あれば、カット追加・削除やタップ同期の後も使えます。オンの間は素材一覧からランダムな順で割り当て、繰り返し表示します。空カットとロックしたカットは維持します。素材の個別指定はオフにすると再び使え、元の割り当てに戻ります。

前景・背景の「行とカット」の上にある「歌詞に合わせて一括挿入」で、歌詞に合わせた素材カットを作り、開始フレームをリンクできます。「一括挿入の基準」で「行に合わせる」（初期値）または「カットに合わせる」を選択します。行単位では各行の先頭、カット単位では行内の分割・間奏・無表示カットを含むリンク可能な境界が対象です。自動生成のタイトルカードは対象外です。選択は前景・背景ごとに保存されます。ランダム順OFFではアップロード順、ONではランダム順で割り当てます。ループOFFでは素材数まで、ONでは素材を繰り返して対象の境界ごとに作成します（最大1000カット）。対象レイヤーの既存カットとそのリンクは置き換わり、1回の「元に戻す」で復元できます。前景・背景の両方で実行すると、歌詞を含めた3レイヤーの開始位置がリンクされます。カット数の入力欄は廃止し、個別の追加・削除、一括挿入、タップ同期でカットを作成します。

旧プロジェクトで個別指定した6項目は「従来の設定」として維持します。別の手法を選ぶと新しい設定が優先されます。配置・サイズは、手動設定がなければ演出に合わせて自動選定され、シャッフルで変化します。縦横比を保ったまま、中央・左右・上下・四隅などの構図とサイズを選びます。背景の自動サイズは「全体を表示」を100％として100〜135％で選定し、拡大した範囲内で位置を変えます。手動配置とロック済みの配置は維持されます。「自動配置に戻す」で再び自動選定できます。詳細の「配置・サイズにも自動で変化を付ける」をオフにすると中央の全体表示に戻ります（手動配置・ロックを除く）。演出無しと従来の設定は従来通りの配置です。動画ループ、クロマキー、開始時刻は手法とは独立しています。つなぎは隣接する素材カットがある場合に適用されます。

## BPM同期

10種類（ズーム、バウンス、スウェイ、オービット、回転、シェイク、ハートビート、2拍ブリーズ、ステップ、フェード）を追加しました。「曲・タイミング」のBPMを使用し、未設定時は120 BPMです。拍の位置は動画全体の時間と拍オフセットを基準にするため、カットごとに拍がリセットされません。動画素材の再生速度は変更しません。登場・退場や手動指定は保持したまま、BPM同期の手法を選択できます。

## 追加バリエーション（第2弾）

33種類を追加しました。各カットの手法選択はカテゴリ別に表示されます。

| カテゴリ | 追加内容 |
| --- | --- |
| シネマ・モーション（8種類） | アーチ移動、8の字、奥行き軌道、スパイラル着地、スリングショット、ホッピング、ジグザグ、ブーメラン |
| マスク・出現（10種類） | 斜めスリット、扇、クロス、ハニカム、波形、ピクセル散開、同心円、交互シャッター、シェブロン、対角モザイク |
| 分割・残像（10種類） | ウェーブスライス、ズーム残響、4分割ミラー、フィルムストリップ、万華鏡、ミラーデュオ、サテライト、ピクセルモザイク、リボン分解、RGB分離 |
| 色・質感（5種類） | インクシルエット、グラデーション染め、ネオン輪郭、ライトスイープ、ドットプリント |

透過素材・クロマキー処理後の動画にも使用できます。マスクや加工は素材の透明度を使って描画し、元動画のフレーム更新にも追従します。

## 追加バリエーション（第3弾）

前景・背景に共通で、以下を追加しました。すべて曲テーマ（おまかせのテーマ）の候補に反映済みです。素材の透明部分・クロマキーで抜いた部分は塗りつぶしません。

| カテゴリ | 追加内容 |
| --- | --- |
| 登場・退場（各14種類） | 落下バウンド、エラスティックズーム、渦巻き、起き上がり（退場は折りたたみ）、明滅、シェイク、ゴムスナップ、時計回りリビール、星形アイリス、ハート形アイリス、ランダムバー、筆ストローク、水玉リビール、対角スプリット |
| カメラ（4種類） | ケン・バーンズ、ダッチアングル、クレーン上昇、手持ちカメラ |
| ダイナミックモーション（4種類） | ローリング横断、スラムズーム、ゆっくり1回転、3段ズーム |
| BPM同期（7種類） | ビート・ゼリー、キック・ズームアウト、拍ごとに左右傾き、拍ごとに左右スライド、4拍フリップ、ビート・反射移動、8拍ビルドアップ |
| 色・質感（8種類） | ライトリーク、フィルムグレイン、ビネット、色相サイクル、ブラウン管、サーモグラフィ、ソフトブルーム、青写真 |
| 分割・残像・グリッチ（6種類） | ズームトンネル、タイルスクロール、縦ウェーブスライス、ストロボ残像、帯ずらし、ガラス破片 |
| カット間のつなぎ（5種類） | ブラインド接続、短冊ずらし接続、モザイク接続、罫線ワイプ接続、升目送り接続 |

追加したつなぎは、手法として選んだ場合だけ使います。従来の設定のカットがランダムに選ぶつなぎの候補は変わりません。
## 歌詞カメラの流用

詳細 → 手法の「カメラ」（歌詞用のカメラワーク36種類）を、前景・背景の「カメラ」にも「カメラ：〇〇」として追加しました。歌詞と同じ動きを、素材の枠に合わせた大きさで適用します。拍に合わせるカメラは歌詞と同じ拍（音源の解析結果またはBPM設定）を使います。動きの強さは詳細 → 前景／背景の「動きの強さ」で調整できます。

自動選定の初期値は歌詞のランダムの規則に従います。追加分・和風・パーツセット（ホラーなど）の設定でランダムの対象外になっているカメラは、初期状態でOFFです（手動では常に選べます）。曲テーマでは、各テーマの歌詞カメラの候補が前景・背景にも使われます。
## 装飾の流用

詳細 → 前景／背景の「装飾を有効にする」（初期値：OFF）をONにすると、手法が「自動」の画像・動画カットに、詳細 → 手法の「装飾」を付けます。候補は詳細 → 前景／背景の「装飾」欄で前景・背景ごとにチェックでき（初期値は素材の手前に描く装飾がON、背面の装飾がOFF）、ランダムの規則（追加分・和風・パーツセット）にも従います。カットごとに1〜2個を選びます。「おまかせ」では装飾のチェックもランダムに設定し、曲テーマではテーマの装飾候補を反映します。シャッフルで変わり、ロックしたカットでは維持されます。手動で選んだ手法・演出無し・従来の設定のカットには付けません。

装飾は素材の枠を歌詞の表示範囲とみなして描き、素材と同じ動き・マスク・加工がかかります。カットの詳細編集の「装飾」から、どのカットにも手動で追加・削除できます（背面の装飾は素材の下に描くため、透過素材で使えます）。演出コピペの対象にも含まれます。
## カットのマスク

カットの詳細編集の「マスク」（初期値：オフ）で、前景・背景・歌詞のカットをマスクできます。基準の画像の上に図形（円・四角・角丸四角・三角・ひし形・五角形・六角形・星・ハート）を配置し、図形の内側をドラッグで移動、角のハンドルで拡大縮小、図形の周囲をドラッグで回転（Shiftで15°刻み）できます。数値でも形・位置・サイズ・角度を指定でき、「アスペクト比を固定」（初期値：ON）で縦横比を保ちます。図形の重なりは和として表示範囲になります。「マスク反転」で図形の外側を表示します。

- **マスク対象：素材** 前景・背景は素材画像を基準に素材そのものをマスクし、マスク後の素材に演出・エフェクトがかかります。歌詞は表示範囲を基準にマスクし、カメラなどの演出と一緒に動きます。
- **マスク対象：カット** 画面全体を基準に、演出・エフェクト適用後のカットをマスクします。前景をマスクした部分には下のレイヤーが見えます。

マスクは表示範囲と同様に形の設定なので、演出コピペの対象外で、貼り付け先のマスクを維持します。
## English

Choose a main technique, **Entrance**, and **Exit** independently on each foreground/background cut. Entrance and Exit default to **Auto**. **No effects** disables the main motion/treatment; choose **Instant (none)** for both phases too to display the file instantly. Videos continue playing normally. Each automatic phase uses only its enabled category; an empty pool means Instant. Explicit selections and locked phases survive shuffle.

The effect preview (▶) has Motion intensity, Treatment intensity and Entrance / exit sliders. They start from the current Details values and change the preview only, not the project. A display-only seek bar shows the playback position, and entrance previews replay about one second after the entrance finishes.

Click a category heading in Details to expand or collapse it. Headings show the enabled/total technique count. Each category has **Enable all**, **Disable all**, and **Invert** controls.

**Randomize** chooses a random set of checked techniques independently for foreground and background. It preserves motion/treatment intensity, entrance/exit duration, and automatic placement settings. The selections support Undo/Redo, Previous/Next variation, and project saving. **Shuffle** keeps the checked set and rerolls the automatic cuts within it.

**Details → Foreground / Background** contains 55 entrances, 55 exits, and 146 main techniques (including transitions and lyric cameras). Categories are Entrance, Exit, Camera, Dynamic motion, BPM sync, Color/texture, Panels/echoes/glitch, and Cut transitions. Existing reveal effects have moved into the phase categories. Adjust motion and treatment intensity, entrance/exit duration, and the techniques included in Auto. Each layer has its own settings, including automatic placement. Previously shared settings are copied to both layers when an older project is opened.

**Shuffle foreground** and **Shuffle background** reroll automatic cuts only in the corresponding layer. The main Shuffle button still rerolls both layers. Explicit selections and locked cuts are preserved. A cut's dice button switches it to Auto and rerolls it. Existing projects keep their individual settings as **Legacy settings** until a new technique is selected. With automatic placement enabled, effect cuts without manual placement vary their position and size on shuffle, preserving the source aspect ratio. Automatic background size stays between 100% and 135% of the full-fit size, with position shifts limited to the available crop on enlarged axes. Manual placement and locked cuts stay fixed. Use Reset automatic placement to return a manually placed cut to automatic composition. Disable Vary position and size automatically in Details to keep automatic cuts centered at full fit. No effects and Legacy settings retain their original framing. Video looping, chroma key, and timing remain independent of technique selection. Transitions apply between adjacent media cuts.

**BPM sync** adds ten motions: zoom, bounce, sway, orbit, turn, shake, double heartbeat, two-beat breathing, steps, and fade. They use the configured BPM, falling back to 120 when unset. The global timeline and beat offset keep beats aligned across cuts. Source video playback speed is unchanged.

The second pack adds 33 techniques: 8 camera/motion variations, 10 masks/reveals, 10 panel/echo effects, and 5 color/texture treatments. Per-cut choices are grouped by category. New effects support transparent assets and live video frames; selection is deterministic for the same seed.

The third pack adds, for both foreground and background: 14 entrances and 14 matching exits (drop and bounce, elastic zoom, swirl, fold up, flicker, shake, rubber snap, clock reveal, star iris, heart iris, random bars, brush strokes, polka-dot reveal, diagonal split); 4 camera moves (Ken Burns, Dutch angle, crane up, handheld); 4 dynamic motions (roll across, slam zoom, slow full turn, three-step zoom); 7 BPM motions (jelly, kick zoom out, tilt, side slide, four-beat flip, wall bounce, eight-beat build-up); 8 textures (light leak, film grain, vignette, hue cycle, CRT scanlines, thermal, soft bloom, cyanotype); 6 panel effects (zoom tunnel, tile scroll, column wave, strobe echoes, band shift, glass shards); and 5 transitions (blinds, slice shift, pixelate, rule wipe, grid cells). All of them are included in the curated themes. Transparent and chroma-keyed areas stay transparent. The new transitions are used only when selected as a technique; random transitions for legacy cuts are unchanged.

The 36 lyric cameras (Details → Techniques → Camera) are also available as **Camera: …** techniques under Camera for the foreground and background. They move with the media frame, follow the same beats as the lyrics, and scale with Motion intensity. By default, Auto uses the cameras that lyric random picks may use (Extra parts, Japanese motifs and part sets such as Horror); the others start unchecked but can always be chosen by hand. Themes share their lyric camera pool with both media layers.

**Cut masks** (Mask in the cut details, off by default) work on foreground, background and lyric cuts. Place shapes (circle, rectangle, rounded rectangle, triangle, diamond, pentagon, hexagon, star, heart) on a reference image: drag inside to move, drag the corner handle to resize, drag around the shape to rotate (Shift snaps to 15°), or type shape, position, size and angle. **Lock aspect ratio** (on by default) keeps the proportions. Overlapping shapes add up to the visible area, and **Invert mask** shows the outside instead. With **Source** as the mask target, media masks the source image itself, so techniques and effects apply to the masked source, while lyrics are masked within their display area and move with the camera. With **Cut**, the finished cut is masked after its effects, relative to the whole stage; masked parts of the foreground reveal the layers below. Like the display area, masks are shape settings: effect copy/paste leaves the target's mask as it is.

**Enable decorations** in Details → Foreground / Background (off by default) adds lyric decorations from Details → Techniques to Auto image and video cuts. One or two decorations are chosen per cut from the layer's own Decoration group in Details → Foreground / Background (front decorations on and back ones off by default) and the random rules (Extra parts, Japanese motifs, part sets); they change with Shuffle and stay on locked cuts. Randomize also randomizes the decoration checks, and themes apply their decoration pool. Explicit techniques, No effects and Legacy settings stay plain. Decorations use the media frame as their display area and follow its motion, masks and treatments. Add or remove them on any cut under Decoration in the cut details (back decorations sit under the source, so they suit transparent assets); effect copy/paste includes them.

Random order remains available after adding/removing cuts or tap sync when at least two files are uploaded. While enabled, media is assigned in a seeded shuffled cycle; blank and locked cuts are preserved. Turn it off to restore the underlying assignments and select files individually.

Use **Insert cuts aligned to lyrics**, above **Lines and cuts** in the Foreground or Background source tab, to create linked media cuts. Choose **Lyric lines** (default) or **Lyric cuts** under **Align inserted cuts to**. Line mode uses line starts; cut mode includes inner lyric cuts, interludes, and blank cuts. Automatically generated title cards are excluded. Each layer saves its own choice. Files follow upload order or Shuffle order. With Loop cuts off, each file is used once; with it on, files repeat across the selected boundaries (up to 1000 cuts). This replaces the selected layer's cuts and links; one Undo restores them. Run it for both layers to link foreground, lyrics, and background together. The cut-count input has been removed; use individual add/remove buttons, bulk insertion, or tap sync to create cuts.
