# JIZURA MCP（ローカル実行・β）

JIZURAの既存エンジンを専用ブラウザで動かし、MCP対応エージェントから編集・評価・書き出しを行います。公開PagesにサーバーやAPIキーを置く必要はありません。通常のWeb画面にはMCPコードを読み込みません。

## 起動

Node.js 20以上とChromium系ブラウザが必要です。Windowsではインストール済みMicrosoft Edgeを使います。

```sh
cd mcp
npm install
node server.mjs
```

他のOSでは `npx playwright install chromium` を実行してください。初回・ソース変更後はリポジトリ直下で `python build.py` を実行します。

MCPクライアントの設定例（パスは自身の環境の絶対パスへ変更）：

```json
{
  "mcpServers": {
    "jizura": {
      "command": "node",
      "args": ["F:/path/to/JIZURA/mcp/server.mjs"],
      "env": {"JIZURA_OUTPUT_DIR": "F:/videos/jizura-output"}
    }
  }
}
```

- `JIZURA_OUTPUT_DIR`: 保存先。省略時 `mcp/output`。出力名はファイル名のみ。既存ファイルは上書きしません。
- `JIZURA_BROWSER`: ブラウザ実行ファイルの絶対パス（任意）。
- `JIZURA_HEADLESS=0`: 操作状態をブラウザでも確認したい場合。通常は非表示実行。
- stdioはMCP通信専用です。手動起動して文字入力する形式ではありません。
- ローカルHTTPはランダムポート・127.0.0.1限定。プロジェクト入力は一時URLでブラウザへ渡し、処理後にURLを失効させます。外部公開しないでください。
- フォントは既存JIZURAと同じ仕組みで取得します。完全オフライン時は必要なフォントを取り込んでください。

## エージェントの制作手順

`jizura://workflow` リソース／`create-video` プロンプトからも手順を取得できます。

1. `session_create` → `catalog`。テーマ・各演出の実際のIDを取得。
2. `theme_set`。複数テーマも指定可能。`theme_candidates` は選択テーマの候補の和集合。
3. `asset_import` で音源・画像・動画・フォントを読み込み。`project_edit` で歌詞・動画サイズ・長さを設定。
4. `audio_preview` で音声を確認。`audio_analysis` のbeats/energyを参考に `cut_timing` で開始フレームを指定。**拍検出は歌詞の発音位置を示すものではありません。** 自動文字起こしは含みません。
5. `cut_insert` で前景・背景素材を配置。`cut_update` で配置・角度・透明度・合成・マスク等を調整。
6. `generate` でテーマに沿うおまかせ生成。seedを保存すれば再現可能。
7. `preview_frame` で登場・保持・退場・境界付近を確認。必要に応じ `audio_preview` で同期を評価。
8. `cut_effect` で候補内の別案を選ぶ／再抽選。`cut_update` で微調整。評価と改善を繰り返す。
9. `project_audit` で技術的問題・テーマ外演出を確認。エージェント自身が読みやすさ・構図・音との同期等を評価し、`quality_approve` に現在のrevisionと評価記録を渡す。
10. `export_start` → `job_status` がcompletedになるまで確認。project/settings保存は評価前でも可能。

編集すると評価済み状態が失効します。フレーム画像を一度も確認していない状態では承認できません。機械的検査は美的品質を保証しません。評価コメントを定型文だけで済ませず、実際に確認した箇所・改善点を記録してください。

## 操作一覧

| 操作 | ツール |
|---|---|
| プロジェクト作成・終了 | session_create / session_close |
| 状態・設定・解決済みカット一覧 | project_get |
| テーマ／候補取得 | catalog / theme_set / theme_candidates |
| プロジェクト・設定・音源・動画・画像・フォント読み込み | asset_import |
| 全設定編集 | project_edit |
| おまかせ作成 | generate |
| 歌詞・前景・背景の挿入、歌詞をその位置で終える（blank） | cut_insert |
| 開始フレーム・リンク | cut_timing / boundary_link |
| 分割・削除 | cut_split / cut_delete |
| カット設定・マスク・合成 | cut_update |
| 項目単位の別案・再抽選 | cut_effect |
| カット再抽選・現在の演出をOFFにして再抽選 | cut_randomize |
| 演出コピー | cut_copy_effects |
| 編集の取り消し（30件） | project_undo |
| 実描画画像／元音声クリップ | preview_frame / audio_preview |
| 区間を指定した拍・音量解析 | audio_analysis |
| 検査・評価記録 | project_audit / quality_approve |
| 保存・出力・状況・中止 | export_start / job_status / job_cancel |

`layer` は `foreground` / `lyrics` / `media`（背景）。indexは**現在の解決済みカット配列**の0始まりです。挿入・削除・再生成後は再取得してください。境界IDは `f:0`, `m:0`, `l:行番号:分割番号`。フレーム番号も0始まりです。

`project_get` のカット一覧は各レイヤー50件ずつです。`offset` / `limit`（最大200）で続きを取得でき、`cutCounts` に総数が返ります。`includeProject:false` で設定全体の再取得を省略できます。

`project_edit` は現行エンジンのJSON設定を直接編集するため、画面の設定を網羅できます。`catalog.defaults` と `project_get.project` で形を確認してください。任意のJavaScript実行機能は提供しません。テーマ外の直接編集／古いプロジェクトの読み込みは検査で報告され、最終出力前に修正が必要です。

### 設定の例

`project_edit` の `changes`：

```json
[
  {"path":["lyrics"],"value":"最初の歌詞|ルビ\n次の歌詞"},
  {"path":["durationOverride"],"value":30},
  {"path":["videoSize"],"value":{"w":1920,"h":1080}},
  {"path":["fps"],"value":24},
  {"path":["layerVisibility","foreground"],"value":true}
]
```

前景／背景の `cut_update.patch`：

```json
{
  "placement":{"cx":0.5,"cy":0.5,"w":0.7,"h":0.7,"angle":15,"lockAspect":true},
  "videoStart":2.5,
  "videoLoop":true,
  "chromaKey":false,
  "blend":"screen",
  "opacity":80,
  "details":{
    "mask":{"enabled":true,"target":"source","invert":false,
      "shapes":[{"type":"ellipse","cx":0.5,"cy":0.5,"w":0.8,"h":0.8,"angle":0}]}
  }
}
```

`placement` は画面比率、動画開始位置は秒。歌詞では `details.area: {x,y,w,h,angle}` を使います。`details` を渡すとそのオブジェクトを置き換えるため、既存設定を残す場合は取得した値をマージしてください。演出IDは `catalog` から取得し、`cut_effect` の利用を推奨します。フォント・色・装飾パラメータなども `catalog.detailKeys` に従って設定できます。

背景のコピー素材は `@copy:foreground-source` / `@copy:foreground-render` / `@copy:lyrics`。素材インポートとカット挿入は別操作です。

## 保存と書き出し

`export_start.kind`：

- `project`: 元音源・素材・フォントを含む `.jizura`。通常画面でも開けます。
- `settings`: 設定だけの `.jizura`。
- `mp4`: MP4（ブラウザのWebCodecs対応が必要）。
- `png` / `png-transparent`: PNG連番ZIP。`every` で出力間隔を指定可能。
- `ae`: After Effects連携用JSON。Web専用演出は既存AE連携と同じ代替表現になります。

ファイル作成完了は `job_status.status=completed` で判断します。failed時はerrorを確認してください。セッション終了前に必ずプロジェクトを保存してください。MCP終了時に編集セッションは破棄されます。インポートはundo対象外です。長尺・高解像度の出力は時間とメモリを使うため、短尺・低解像度で確認してから本出力してください。

MP4完了時の `metadata` には映像コーデック・音声コーデック・実出力サイズが返ります。音声を必要とする場合は `metadata.audio` がnullでないことも確認してください。テーマの制約はJIZURA内蔵の演出候補に対して適用されます。アップロード画像・動画の内容が曲に合うかはエージェントが評価します。

## 開発・検証

```sh
python build.py
cd mcp
npm install
npm test
```

テストは公式MCPクライアント→stdio→ブラウザ→既存エンジンを通し、テーマ選択、素材・カット編集、プレビュー、各出力とプロジェクト再読み込みを確認します。生成物はOSの一時フォルダに保存します。

任意の `JIZURA_TEST_VIDEO` / `JIZURA_TEST_FONT` にローカルファイルの絶対パスを設定すると、動画分割・シーク／フォント保存復元も検証します。依存関係を固定して再現する場合は `pnpm install --frozen-lockfile` を使用できます。
