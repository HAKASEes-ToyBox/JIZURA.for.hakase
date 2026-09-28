# エージェントによるお気に入り演出の作成

## 作成から利用まで

1. MCPの `session_create` → `favorite_spec` と `catalog` を読む。
2. 既存演出を調整する場合は、テーマを設定してカットを作り、`favorite_save` に `layer` / `index` を渡して保存する。
3. 新しい描画を作る場合は、下記の `details.drawing` を含むpayloadを作成する。
4. `favorite_validate` で検証し、`favorite_save` で保存。返されたIDを保持する。
5. `favorite_preview` にIDと `time`（カット内の秒数）を渡す。MCPからPNG画像が返るので、登場・中盤・退場の複数時点を実際に確認する。`layer` / `index` を省略するとサンプル歌詞・画像、指定するとそのカットが対象になる。プロジェクトは変更しない。
6. 改善時は `favorite_save` に同じIDと修正版payloadを渡す。
7. `export_start` に `kind: "favorites", filename: "my-effects.jizuraichifav"` を渡し、`job_status` がcompletedになるまで待つ。
8. Web版の「☆お気に入り演出」→「インポート」で読み込む。カットの←☆から適用する。

`asset_import` の `kind: "favorites"` でも専用ファイル／通常プロジェクトから読み込める。`mode` は `append` または `replace`。`favorite_list` / `favorite_apply` / `favorite_delete` も利用できる。

お気に入りファイルはお気に入りとフォント情報を入れたJIZURAコンテナ。ファイル構造を自作せず、APIのエクスポートを使用する。歌詞・素材・カットは含まない。

## 描画プログラム v1

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

既存レイアウト等のパラメータは `favorite_spec.detailKeys` と `catalog`、対象カットの状態を参照。存在しないIDを作らない。独自プログラムの見た目がテーマに合うかはエージェント自身が画像を評価する。監査では独自描画を含むカットについて視覚評価を促す警告を返す。

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
