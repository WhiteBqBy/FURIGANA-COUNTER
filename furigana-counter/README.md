# ふりがな変換＋文字数カウント（VS Code 用ミニマル構成）

Vite + React + TypeScript + Tailwind CSS v4 + kuromoji.js のスタンドアロン版です。
サーバー・ログイン・データベースは一切使わず、すべてブラウザ内で動きます。

## 使い方

```sh
npm install
npm run dev
```

ブラウザで表示された `http://localhost:5173` を開いてください。
VS Code で開くには、このフォルダで `code .` を実行します。

## ビルド

```sh
npm run build
npm run preview
```

`dist/` フォルダをそのまま静的ホスティング（Netlify / Vercel / GitHub Pages など）に置けます。

## 構成

```
furigana-counter/
├─ index.html            # メタ情報・Google Fonts
├─ vite.config.ts        # Vite + Tailwind + "@" エイリアス
├─ tsconfig.json
└─ src/
   ├─ main.tsx           # エントリーポイント（Toaster 含む）
   ├─ App.tsx            # 画面（入力＋3種類の変換＋4種類のカウント＋コピー）
   ├─ styles.css         # デザイントークンとルビの見た目
   └─ lib/furigana.ts    # 形態素解析・ふりがな生成・文字数カウント
```

## 辞書について

形態素解析には kuromoji.js を使い、本体と辞書（約 20MB / gzip 圧縮済み）は
CDN（jsDelivr）から読み込みます。初回だけ数秒かかり、その後はブラウザキャッシュが効きます。
設定は `src/lib/furigana.ts` の先頭にある `CDN` 定数だけです。

自前ホストしたい場合は `npm i kuromoji` して
`node_modules/kuromoji/build/kuromoji.js` と `node_modules/kuromoji/dict/` を
`public/kuromoji/` にコピーし、`CDN` を `/kuromoji` に変えてください。
※ この場合、配信サーバーが `.gz` ファイルに `Content-Encoding: gzip` を付けないよう
注意が必要です（付くと辞書の解凍に失敗します）。


## 文字数カウントの仕様

- 総文字数
- 句読点除外
- 空白・改行除外
- 句読点・空白・改行除外

①ルビ付き原文と②横ふりがな文章のカウントは「元の文章」を基準に計算し、
追加されたふりがな・括弧は含めません。③完全ひらがなは変換後の文章そのものを数えます。
