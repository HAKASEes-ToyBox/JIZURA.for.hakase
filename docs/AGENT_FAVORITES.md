# エージェントによるお気に入り演出の作成

## 作成から利用まで

1. MCPの `session_create` → `custom_effect_spec`、`favorite_spec`、`catalog` を読む。
2. 既存演出を調整する場合は、テーマを設定してカットを作り、`favorite_save` に `layer` / `index` を渡して保存する。
3. 標準の開始・保持・終了・背景・装飾等のIDとパラメータを使う。足りない要素だけを下記のコンポーネントとして作成し、`custom_effect_validate` → `custom_effect_import` で登録する。装飾は `decor`、登場は `enter` のように対応する要素へ登録する。
4. `favorite_validate` で検証し、`favorite_save` で保存。返されたIDを保持する。
5. `favorite_preview` にIDと `time`（カット内の秒数）を渡す。MCPからPNG画像が返るので、登場・中盤・退場の複数時点を実際に確認する。`layer` / `index` を省略するとサンプル歌詞・画像、指定するとそのカットが対象になる。プロジェクトは変更しない。
6. 改善時は `favorite_save` に同じIDと修正版payloadを渡す。
7. `export_start` に `kind: "favorites", filename: "my-effects.jizuraichifav"` を渡し、`job_status` がcompletedになるまで待つ。
8. Web版の「☆お気に入り演出」→「インポート」で読み込む。カットの←☆から適用する。

`asset_import` の `kind: "favorites"` でも専用ファイル／通常プロジェクトから読み込める。`mode` は `append` または `replace`。`favorite_list` / `favorite_apply` / `favorite_delete` も利用できる。

お気に入りファイルはお気に入り・独自効果定義・フォント情報を入れたJIZURAコンテナ。ファイル構造を自作せず、APIのエクスポートを使用する。歌詞・素材・カットは含まない。

## 標準要素へ登録する独自効果 v1

`custom_effect_spec` が現在の仕様。`custom_effect_list` で登録済み定義を取得する。定義は `project.customEffects` に保持され、通常プロジェクト、設定のみ、お気に入りの書き出し・読み込みに含まれる。お気に入りファイルのインポート時にも各効果一覧へ登録される。

| group | 適用先・設定欄 |
|---|---|
| `layout` | 歌詞のレイアウト／スタイルタブ |
| `enter`, `hold`, `exit` | 歌詞の登場・保持・退場／モーションタブ |
| `decor` | 歌詞・前景・背景の装飾／装飾タブ |
| `bg`, `treat`, `cam`, `fx`, `trans` | 歌詞の背景・加工・カメラ・画面効果・つなぎ |
| `media`, `mediaEnter`, `mediaExit` | 前景・背景の手法・登場・退場／モーションタブ |

標準の効果はそのIDを直接使う。独自部分を加える場合は `base` に同じグループの標準IDを指定できる。独自のレイアウト文字にも標準の登場・保持・退場と文字加工が適用される。`program.mode="replace"` は当該要素の基本描画だけを置き換え、他の要素は維持する。前景・背景の素材、画面効果、つなぎに付けるprogramは `overlay` で追加する。

```json
{
  "version": 1,
  "id": "custom_pop_dots",
  "group": "decor",
  "name": "ポップのドット",
  "nameEn": "Pop dots",
  "tags": ["pop"],
  "layer": "front",
  "params": {"radius": 0.08},
  "labels": {"radius": {"ja": "円の半径", "en": "Circle radius"}},
  "program": {
    "version": 1,
    "mode": "overlay",
    "nodes": [{"type": "ellipse", "x": 0.15, "y": 0.2,
      "w": {"param": "radius"}, "h": {"param": "radius"},
      "fill": "accent", "scale": {"from": 0, "to": 1, "ease": "out"}}]
  }
}
```

`custom_effect_import` に `components: [上の定義]` を渡す。詳細→手法の装飾、および前景・背景の装飾一覧に［追加］付きで表示され、通常のチェック・再抽選・プレビューで使える。標準効果の旧［追加］表示は付かない。

標準と独自を組み合わせたお気に入りpayload：

```json
{
  "format": "jizura-cut-effects", "version": 1, "kind": "lyrics",
  "native": {},
  "details": {
    "layout": "center", "enter": "pop", "hold": "still", "exit": "shrink",
    "decor": [{"id": "custom_pop_dots", "radius": 0.12}]
  },
  "components": [{
    "version": 1, "id": "custom_pop_dots", "group": "decor",
    "name": "ポップのドット", "tags": ["pop"], "layer": "front",
    "params": {"radius": 0.08},
    "program": {"version": 1, "mode": "overlay", "nodes": [
      {"type": "ellipse", "x": 0.15, "y": 0.2,
       "w": {"param": "radius"}, "h": {"param": "radius"}, "fill": "accent"}
    ]}
  }]
}
```

`components` には実際の定義オブジェクトを入れる。カットを `favorite_save(layer,index)` で保存した場合は参照する定義が自動で含まれる。

`custom_effect_preview(id,time)` は標準パイプラインでPNGを返す。対象のカットで見る場合は `layer/index` も指定する。定義だけのプレビュー、組み合わせたお気に入りのプレビュー、実際のカットのプレビューを複数時点で確認する。

`params` は標準のJSONパラメータの初期値。`labels` に表示名を指定できる。歌詞の登場・保持・退場は `details.enterP/holdP/exitP`、前景・背景は `details.techniqueP/entranceP/departureP`、装飾は `details.decor` の各要素のパラメータで調整する。数値をprogram/motionで使う場合は `{ "param": "radius", "default": 0.08 }` として参照する。アニメーションの振幅・端点にも指定できる。

`motion` は `x/y`（表示サイズの比率）、`rotation`（度）、`scale/sx/sy/opacity`（倍率）。登場・退場はフェーズ内の進捗、保持はカット全体の進捗で動く。カメラの不透明度はカット側で指定する。

`tags` または `themes` は必須で、テーマ候補に反映される。テーマ外の効果は取り込み時に自動候補から外れる。タグは作者の申告なので、エージェントは実際の画像でテーマへの適合を評価する。同じIDで異なる定義の取り込みは拒否されるため、改版は新しいIDを使う。お気に入り上書き時も、既存カットが参照する効果定義は維持する。

## 従来のカット全体の描画プログラム v1（互換用）

独自描画はJSONのCanvas2D命令で記述する。JavaScriptソースの実行ではない。静止図形だけでなく、時間に応じた移動・拡縮・回転・透過・文字配置・素材描画を新規作成できる。

```json
{
  "format": "jizura-cut-effects",
  "version": 1,
  "kind": "lyrics",
  "native": {},
  "details": {
    "drawing": {
      "version": 1,
      "mode": "replace",
      "nodes": [
        {"type":"rect","x":0.1,"y":0.35,"w":0.8,"h":0.3,"fill":"accent"},
        {"type":"text","text":"$text","x":0.5,"y":0.5,"w":0.75,"size":0.14,"fill":"fg","rotation":{"value":0,"amplitude":3,"cycles":1}},
        {"type":"text","text":"$note","x":0.5,"y":0.3,"w":0.7,"size":0.045,"fill":"fg"}
      ]
    }
  }
}
```

- `kind`: `lyrics` または `media`（画像・動画共通）。画像には `native.technique: "none"` を指定すると既存モーションを抑えられる。
- `mode`: `replace` は通常の文字レイアウト／素材描画を置換、`overlay` は通常描画の上に追加。歌詞の配置エリア・カメラ・マスク・合成・透明度など外側の処理は維持する。
- `nodes`: 描画順の配列、最大64件。命令全体は32KB以内。
- `type`: `rect`、`ellipse`、`line`、`text`、`arcText`（歌詞をアーチ状に配置）、`source`（適用先の画像／動画）。外部URLは指定しない。
- `x,y,w,h`: 画面ではなく適用対象の表示エリア／配置後の素材サイズに対する比率。既定はすべて0.5。`rect`のx/yは左上、`line`は開始点でw/hが終点への差分、それ以外は中心。
- `rotation`: 度数。`scale`: 等倍が1。`opacity`: 0〜1。
- `size`: 文字サイズ。対象の短辺に対する比率、既定0.12。`w`内に収める場合も縦横比を維持する。
- `lineWidth`: 線幅の短辺比、既定0.005。
- `frame`: 座標の基準。`area`（既定、表示エリア）、`text`（装飾のみ：登場完了後の歌詞の文字枠）、`textX` / `textY`（横または縦だけ文字枠）。文字枠基準の装飾は、文字サイズ・歌詞・表示エリアが変わっても文字に追従する。文字枠が無い対象（素材の装飾、空の歌詞）は表示エリアに戻る。`size` / `lineWidth` / `bounce` は基準枠の短辺比になる。
- `units`: `short` にすると `w,h` を基準枠の短辺比で解釈する。円・正方形・角度付きの線が、どの縦横比でも歪まない。既定 `frame` は従来どおり縦横それぞれの比率。
- `ox,oy`: 基準枠に配置した後に加えるずらし量（短辺比、アニメーション可）。部品同士の位置関係を縦横比に依存させない場合に使う。
- 縦横比・文字サイズに依存しない作り方：形を保ちたい図形は `units:"short"`、文字に付く装飾は `frame:"text"`、部品の相対位置は `ox/oy`。ハートなど複合図形は図形の組み合わせより `♥` 等の文字（`text`）で描くと崩れない。レイアウトのprogramは描いた文字の範囲を返すため、独自レイアウトにも標準装飾・文字枠基準の装飾が付く。
- `fill,stroke`: `fg,bg,accent,accent2,sub,ink,dim` または `#RRGGBB` / `#RRGGBBAA`。テーマの配色を使うには色名を優先。素材側の色名には既定配色を使用する。
- `text`: `$text`（適用先歌詞）、`$note`（ルビ・注釈）、または固定文字列。`font`: catalogのフォントキー。省略時は歌詞のフォント、素材はsans-serif。
- `source`: 適用対象の素材をw/h内に縦横比を維持して描画する。`replace`で素材も見せたい場合、この命令を含める。

数値フィールドには固定値のほか次を指定可能。時間はカット全体を0〜1とした進捗。

```json
{"from":0.1,"to":0.9,"ease":"out"}
```

`ease` は `linear` / `in` / `out` / `inOut`。または周期的な変化：

```json
{"value":0.5,"amplitude":0.1,"cycles":2,"phase":0}
```

`value + amplitude × sin(進捗 × cycles × 2π + phase)`。phaseはラジアン。

既存レイアウト等のパラメータは `favorite_spec.detailKeys` と `catalog`、対象カットの状態を参照。標準IDはcatalogから取得し、独自IDはコンポーネントを登録してから使う。独自プログラムの見た目がテーマに合うかはエージェント自身が画像を評価する。監査では独自描画を含むカットについて視覚評価を促す警告を返す。

## ブラウザAPI

通常Webページでも `J.favoriteAPI` を使用できる。

```js
const specification = J.favoriteAPI.spec();
const checked = J.favoriteAPI.validate(payload);
const favorite = J.favoriteAPI.save(J.ui.project, {name: '独自演出', payload: checked});
J.uiApi.replan(); // 編集UI・自動保存を更新
const png = await J.favoriteAPI.preview({payload: checked, time: 1, width: 640});
// png.data はPNGのbase64。画像として表示可能。
const blob = await J.exportEffectFavorites(J.ui.project);
await J.saveFile('my-effects.jizuraichifav', blob);
await J.favoriteAPI.import(J.ui.project, file, 'append');
J.uiApi.replan();
```

プレビューの対象指定：`project: J.ui.project, target: {layer:'lyrics',index:0}`。indexは生成済みカット配列の位置。`time`は対象カットの長さ未満。PNGの長辺は最大1920px。プレビューだけではカットへ適用されない。

通常の動画書き出しは従来どおり監査・品質承認が必要。お気に入りの保存は品質承認前でも可能。新形式はこの機能を含むJIZURA版で読み込む。

### アーチ文字

`arcText` は `$text` の文字数に合わせ、w/hを直径とする楕円の上側に文字を配置します。`arc` は広がりの角度（既定140度）、`contrast` は大小交互の強度（0〜0.6）、`bounce` は文字ごとの弾み幅（短辺比）です。文字は接線方向へ回転し、縦横比を保ちます。`stroke` と `lineWidth` で縁取りも可能です。実例生成: `node mcp/create-pop-arch.mjs`。
