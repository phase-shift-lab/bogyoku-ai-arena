# Bogyoku shared learning Worker

GitHub Pages 版から、棋譜を送らずに奇襲戦法の匿名集計だけを共有する Cloudflare Worker + D1 です。既存の端末内学習は独立して継続し、この API が停止しても対局を止めません。

## 送信する情報

`POST /v1/learning/events` は次の固定スキーマだけを受け付けます。本文上限は 8 KiB、1イベントの観測上限は12件です。

```json
{
  "schemaVersion": 1,
  "eventId": "550e8400-e29b-41d4-a716-446655440000",
  "observations": [
    {
      "strategy": "bogyoku",
      "side": "sente",
      "branchId": "bogyoku:king-forward",
      "outcome": "win"
    }
  ]
}
```

- `side`: `sente` または `gote`
- `outcome`: `win` / `draw` / `loss`
- `strategy`: アプリ内カタログの固定許可リスト
- `branchId`: 戦法IDそのもの、または `戦法ID:分岐名`（最大64文字）
- `eventId`: UUID。D1には生値ではなく SHA-256 ダイジェストだけを重複防止用に保存

未知のフィールドは拒否します。棋譜、SFEN、指し手、評価値、PV、端末IDなどを送信しないでください。D1に保存するのはイベントダイジェストと戦法・先後・分岐別の勝敗集計だけです。

成功時は新規受付を `202`、重複イベントを `200` で返します。

```json
{ "schemaVersion": 1, "accepted": true, "duplicate": false }
```

`GET /v1/learning/aggregate` は、30局以上集まった行だけを返します。

```json
{
  "schemaVersion": 1,
  "minimumGames": 30,
  "records": [
    {
      "strategy": "bogyoku",
      "side": "sente",
      "branchId": "bogyoku:king-forward",
      "games": 30,
      "wins": 15,
      "draws": 4,
      "scoreSum": 17
    }
  ]
}
```

補正値の計算と安全上限の適用はブラウザ側で行います。

## ローカル準備

Node.js 22 以降を想定しています。

```powershell
Set-Location C:\codex\projects\bogyoku-shogi\worker
npm install
Copy-Item wrangler.example.jsonc wrangler.jsonc
npx wrangler d1 create bogyoku-shared-learning
```

表示された D1 の `database_id` をローカルの `wrangler.jsonc` にだけ設定します。サンプルには実IDを記録しません。

```powershell
npm run db:migrate:local
npm run dev
npm run check
```

## フロントエンド接続

Workerを検証した後、リポジトリ直下の `.env.local` にAPI URLを設定してフロントエンドを再ビルドします。

```dotenv
VITE_SHARED_LEARNING_API_URL=https://bogyoku-shared-learning.example.workers.dev
```

未設定時は共有学習のチェックボックスが無効になり、端末内学習だけで動作します。同意状態はブラウザの `localStorage` に保存されますが、同意しても棋譜・局面・指し手・評価値・PV・端末識別子は送信しません。APIのエラーや不正な集計応答も無視し、エンジン対局を継続します。

## 本番反映

Cloudflareへログイン後、許可OriginとD1 IDを確認してから実行します。

```powershell
npm run db:migrate:remote
npm run deploy
```

`ALLOWED_ORIGINS` はカンマ区切りの完全一致です。本番GitHub Pages Originと必要な開発Originだけを登録してください。`*` は許可されません。CORSはブラウザ制限であって認証ではないため、本文上限・厳格な入力検証・重複排除も維持します。

## 公開APIの防御と保持期間

- `POST` は許可リストに完全一致する `Origin` が必須です。`Origin` がない送信や未許可Originは拒否します。公開集計を読む `GET` はOriginなしでも利用できます。
- 本文はストリーム読取中にも 8 KiB 上限を適用します。`Content-Length` を省略した分割送信でも上限を超えた時点で拒否します。
- 本番サンプルは `REQUIRE_RATE_LIMITER=true` です。Rate Limiting binding が未設定、失敗、または送信元IPを取得できない場合、`POST` は `503` で閉じます。
- Rate Limiter のキーは `SHA-256(Origin + 改行 + CF-Connecting-IP)` です。ハッシュはRate Limiterに渡すだけで、IP・ハッシュともD1へ保存しません。
- `REQUIRE_RATE_LIMITER=false` はローカル開発用です。入力検証は残りますが、公開濫用への防御が弱くなるため、その状態での公開は推奨しません。
- 受領済みイベントのダイジェストは既定30日（設定可能範囲7〜365日）保持し、日次Cronで期限切れを削除します。したがって同一 `eventId` の重複排除が保証されるのは保持期間内です。
- 集計は `score_sum = wins + draws / 2` の完全一致をDB制約と応答変換の両方で検証します。

Cloudflareの公式資料には、Workers Rate Limiting binding がFreeプランで常に利用可能とは明記されていません。外部公開前に実アカウントでテストデプロイしてください。bindingが利用できなければ、Cloudflare側の別のレート制限を設定するか、公開を止めて構成を見直します。本番サンプルは防御なしで黙って稼働せず、`503` に倒れる構成です。

- [Workers Rate Limiting API](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)

Freeプラン上限に達すると共有APIは失敗し得ますが、ブラウザ側はローカル学習へフォールバックしてください。外部公開前にはCloudflareの最新Free枠と運用状況を再確認します。
