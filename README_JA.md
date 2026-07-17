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

棋譜、局面、指し手、評価値、解析結果、端末識別子はブラウザ内で処理し、外部APIへ送信しません。エンジン生成物は固定した出典・ビルド手順・SHA-256を記録しています。

任意参加の匿名共有学習を有効にした場合だけ、戦法・分岐ID・AI手番・勝敗・ランダムなイベントIDを共有APIへ送信します。既定はオフです。共有APIが未設定、停止中、通信失敗、または利用上限に達した場合も、対局と端末内学習はそのまま継続します。

共有APIを使用する開発・ビルドでは、リポジトリ直下の `.env.local` にURLを設定します。未設定なら共有学習UIは無効になります。

```dotenv
VITE_SHARED_LEARNING_API_URL=https://bogyoku-shared-learning.example.workers.dev
```

WorkerとD1の構成、厳格な匿名DTO、保持期間、デプロイ前確認は [worker/README.md](worker/README.md) を参照してください。
