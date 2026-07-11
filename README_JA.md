# Bogyoku AI Arena

棒玉戦略に特化した、ブラウザ完結型の将棋AI対局・解析Webアプリです。合法手処理、YaneuraOu WASM、対局・解析モード、MultiPV、PC・スマートフォン対応UIを備えています。

## 開発環境

- Node.js 24 LTS
- npm 11以上
- エンジンを再ビルドする場合のみ、Emscripten SDK 4.0.21とMSYS2 `make`

```powershell
npm install
npm run dev
```

`http://localhost:5173` を開きます。開発サーバーはCOOP/COEPヘッダーを付与し、利用可能ならthreaded WASM、利用不可または初期化失敗時はsingle-thread WASMへ自動的に切り替えます。

## 主な機能

- 人間 vs AI、AI vs AI、解析
- 先手・後手・ランダム指定と後手時の盤反転
- 平手、二枚落ち、四枚落ち
- 棒玉プロファイル、強度調整、安全フィルター、評価内訳
- SFEN/KIF入出力、IndexedDB自動保存、MultiPV変化一覧

## 品質確認

```powershell
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

詳細は [PLAN.md](PLAN.md)、検証済み進捗は [STATUS.md](STATUS.md)、エンジンの出典と再現手順は [ENGINE_SOURCE.md](ENGINE_SOURCE.md) を参照してください。

## ローカルファースト方針

棋譜、局面、解析結果はブラウザ内で処理し、外部APIへ送信しません。エンジン生成物は固定した出典・ビルド手順・SHA-256を記録しています。
