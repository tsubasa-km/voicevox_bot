# AGENTS — VoiceVox Discord Bot

最短時間で安全にタスクを進めるためのオペレーション指針です。要件や仕様の詳細は別ドキュメントへ切り出しているので、実装前に必ず参照してください。

## 1. ミッションとスコープ
- Discord サーバー内のテキストを VOICEVOX で TTS 化し、同じギルドのボイスチャンネルへストリーミングする。
- 付帯 API（Hono）経由でユーザー設定更新と読み上げリクエストを受け付ける。
- Slash Command で BOT の入退室・話者設定・オート参加などを制御する。

**対象タスク**
- 既存機能の改修や追加。Slash Command・API・VoiceManager まわり。
- ログ、DB、デプロイスクリプトの改善。

**非対象 / 要エスカレーション**
- VOICEVOX エンジン自体の改修。
- Discord 側のアプリ設定やトークン配布作業。
- 顧客／ギルド特化要件などリポジトリ非公開情報の取り扱い。

## 2. 参照すべき仕様
- 機能・ユースケース: `docs/requirements/voicevox.md`
- Slash Command 定義: `src/commands/**/*.ts`
- 外部 API: `src/api/server.ts`
- DB スキーマ: `src/db/**/*.ts`
- インフラ: `Dockerfile`, `docker-compose*.yml`

要件が足りないときは `docs/requirements` を更新したうえで実装に着手すること。AGENTS.md は手順とガードレールのみを記載する。citeturn0search0

## 3. 開発環境とシークレット
- Node.js 22 ベース。ローカルは >=20 で `npm` v10 以上。
- FFmpeg 必須（Dockerfile 参照）。
- VOICEVOX エンジンを別プロセス/コンテナで起動し `VOICEVOX_API_URL` を指す。
- `.env` で最低限 `DISCORD_BOT_TOKEN`, `VOICEVOX_API_URL`, `API_KEY`, `LLM_MASTER_KEY`, `PORT`, `DISCORD_CLIENT_ID` を設定。詳細は `docs/requirements/voicevox.md#環境変数`。
- トークン/キーはログやリポジトリに残さない。共有時は 1Password など安全な手段を使用。

## 4. マストで実行するチェック
| 変更内容 | コマンド / 手順 |
| --- | --- |
| TypeScript の型保証 | `npm run build` （`tsc` + `tsc-alias`） |
| Slash Command を変えた | 1) `.env` で `DISCORD_CLIENT_ID` を設定 2) `npm run deploy:commands -- --guild <テストギルドID>` で即時検証 |
| 依存・Docker 変更 | `docker compose build voicevox_bot` で再ビルド、`docker compose up` で起動確認 |
| DB スキーマ変更 | `npm run build` 後にローカルで `dist/index.js` を一度起動し、`DATABASE_PATH` で指定した SQLite に期待カラムができることを確認 |

CI が無いので、手元でこれらを必ず走らせて結果を共有する。

## 5. アーキテクチャ早見表
| レイヤ | 主要ファイル / 役割 |
| --- | --- |
| Entrypoint | `src/index.ts` — マイグレーション→Discord Client→API サーバー起動→イベント購読。 |
| 音声サービス | `src/services/voicevox.ts` — VOICEVOX `/speakers` `/audio_query` `/synthesis` を叩き PCM Buffer を返す。 |
| 音声セッション管理 | `src/voice/voiceManager.ts` — ギルド単位に `VoiceSession` を保持し、`@discordjs/voice` で join/play/leave。
| コマンド | `src/commands/**` — `/vc`, `/setting`, `/list` を `CommandDependencies` で組み立て。
| 外部 API | `src/api/server.ts` — `PATCH /settings/users/:guildId/:userId`, `POST /speech` を提供。`x-api-key` ヘッダで認証。
| データ永続化 | `src/db/*.ts` — `better-sqlite3` ラッパ（WAL）。`runMigrations` で不足カラム追加。
| ユーティリティ | `src/utils/logger.ts`, `src/utils/textFormatter.ts`。

## 6. 代表的な作業手順
### 6.1 Slash Command を追加/変更
1. `src/commands` にビルダーと `buildXCommand` を追加。
2. `src/commands/index.ts` の `factories` と `slashCommandData` に登録。
3. `CommandDependencies` が必要な値を exposes しているか確認、必要なら `buildCommands` 呼び出し元 (`src/index.ts`) に依存を追加。
4. `npm run build` → `npm run deploy:commands -- --guild <テストギルドID>`。
5. 変更内容とテストギルドでの確認結果を共有。

### 6.2 Voice パイプラインを触る
1. `VoiceManager` でギルドごとのセッションライフサイクルを理解（`join`, `dispatchSpeech`, `leave`, `destroyAll`）。
2. 音声生成は `VoiceVoxService.synthesizeSpeech` で PCM Buffer を取得→`demuxProbe`→`createAudioResource`。フォーマット追加時はここを拡張。
3. 同期処理なので、重い処理は極力 `async` で待機しつつログ出力を忘れない。
4. 実機確認は Discord ギルドで BOT を VC へ接続し、`/vc` → テキスト投稿で再生をチェック。

### 6.3 外部 API を変更
1. すべてのリクエストは `x-api-key` で保護されることを維持する。
2. バリデーションを `POST /speech` / `PATCH /settings` それぞれに追加する場合は 4xx で理由を返すこと。
3. `VoiceManager.dispatchSpeech` の戻り値（bool）を尊重し、false の場合は 409/404 を返す。
4. API 仕様変更は `docs/requirements/voicevox.md#外部 api` を先に更新。

## 7. データ / セキュリティガードレール
- Discord Token や API Key をログや PR に載せない。`.env` の diff をコミットしない。
- SQLite にはギルド ID・ユーザー ID・音声設定・LLM 設定・暗号化済み API キーのみを保存。メッセージ本文は保存しない方針。
- ログ (`logs/bot.log`) は PII を含めない。必要ならユーザー ID をマスク。
- `/speech` API は、ユーザーが BOT と同じ VC に居ない限り応答を拒否する仕様（変更しない）。

## 8. 運用・デプロイ
- ローカル: `npm install` → VOICEVOX エンジン起動 → `npm run dev`。
- `docker-compose.yml`: 開発用。コードを volume mount し `npm run dev` + `npm run deploy:commands` を自動実行。PORT は環境変数から読む。
- `docker-compose-prod.yml`: 公開イメージ `dqxtsubasa/voicevox_bot:latest` を使用し、`sqlite_data` ボリュームへ永続化。ホスト 8080→コンテナ 8080。
- 単体イメージは `Dockerfile`（Node 22 + FFmpeg）で `npm run build` → `npm run start:deploy` を行う。

## 9. ロギングと監視
- `src/utils/logger.ts` で log level を制御し、stdout + ファイルへ二重出力。
- `config.logLevel` を `LOG_LEVEL` で切り替え。長期保存が必要なら `logrotate` やホスト側 volume で処理。
- 異常系: VoiceVox API 失敗、`dispatchSpeech` 拒否、`VoiceConnection` 切断を WARN 以上で可視化。

---
不明点は `docs/requirements/voicevox.md` を更新しつつ解決する。テンプレート遵守で記述を増やしすぎないこと。citeturn0search0


## 10. エージェントのルール
- 応答には日本語を用いること
- API・ライブラリ・フレームワークについては公式ドキュメントを参照し正確な情報を用いてプランニングすること
