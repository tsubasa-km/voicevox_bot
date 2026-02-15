# VoiceVox Bot Requirements

## 1. ユースケース
1. Discord ギルドで BOT を VC に入室させ、テキストチャンネルの発言を即時読み上げる。
2. 各ユーザーが話者 ID / ピッチ / スピードを個別設定し、発話時に反映する。
3. ギルド管理者が BOT の自動入室と優先テキストチャネルを設定する。
4. 外部 Web クライアントが `/speech` を叩き、BOT と同じ VC に居るユーザーのテキストを指定して読み上げさせる。
5. 外部管理ツールが `/settings/users/:guildId/:userId` でユーザー設定を同期する。
6. 読み上げ前に LLMアシスト（2段階）を使って自然化とアクセント補正を行い、自然な読み上げにする。
7. LLM API キーを Discord コマンドで管理し、利用可能ユーザーを制御する。

## 2. 機能要件
### 2.1 Slash Command
- `/vc`: 実行ユーザーが所属する VC に BOT を参加/退出させる。参加できなければエラーメッセージを返す。
- `/setting user speaker|pitch|speed`: 指定ユーザー (デフォルト: コマンド実行者) の設定を更新する。話者 ID は VOICEVOX style ID で存在チェックする。
- `/setting user llm_assist`: 指定ユーザー (デフォルト: コマンド実行者) の LLMアシスト設定を更新する。
  - `enabled` は必須。
  - `provider`, `key_id`, `model` は任意。`key_id` 指定時は `provider` 必須。
  - この設定は第1段階/第2段階で共通利用する。
- `/setting server autojoin`: `ManageGuild` 権限者のみ。auto-join の ON/OFF を切り替え、実行チャンネルを優先テキストチャネルに保存する。
- `/setting key add`: LLM API キーを追加/更新する。
  - 新規作成は誰でも可能。
  - 既存キー更新は「作成者 or `ManageGuild`」のみ。
  - `scope` は `guild|global`。
  - 利用許可ユーザーを最大 5 人までメンション指定でき、未指定時は作成者のみ許可。
- `/setting key delete`: LLM API キーを削除する（作成者 or `ManageGuild`）。
- `/list speakers`: VOICEVOX API `/speakers` から取得し、1900 文字ごとに分割して表示する。
- `/list keys`: 実行者が利用可能な API キーのみを provider ごとにグルーピング表示する（秘密値は非表示）。

### 2.2 メッセージ監視
- BOT 以外のメッセージのみ処理。`formatMessageContent` で正規化し、アクティブな VoiceSession があれば読み上げる。
- メッセージ送信チャンネルを `guild_settings.text_channel_id` に保存し、VoiceSession と同期する。
- 画像添付（`image/*` または画像拡張子）のみの投稿は読み上げ対象外。本文がある場合は本文のみ読み上げる。
- `user_speakers.speaker_id` が未設定のユーザーは `guildId:userId` のハッシュで VOICEVOX style ID を決定し、DBへ新規保存しない。疑似ランダム選択の対象は `styleName` が `ノーマル`（または `normal`）の style のみに限定する。
- `user_llm_assist_settings.enabled = 1` の場合のみ LLMアシストを適用する。
  - 第1段階: 読み上げ向け自然化（省略語展開・時刻正規化・誤字補正）。
  - 第2段階: `audio_query.kana` のアクセント/区切り記号を最小変更で補正し、`accent_phrases?is_kana=true` で再解析。
  - provider 未指定時は固定優先順 `Gemini -> OpenAI`。
  - key_id 未指定時は provider 内で round-robin。
  - フォールバック:
    - 第1段階失敗時: 元テキストで継続。
    - 第2段階失敗時: 第1段階の結果で継続。

### 2.3 VoiceManager
- ギルドごとに 1 セッション管理。ユーザーが離脱してボイスチャンネルに人間が 0 になったら BOT も退出。
- `dispatchSpeech` は発話キューへ追加し、VOICEVOX API が失敗した場合はエラーログだけ出して次のジョブへ進む。

### 2.4 外部 API
- `PATCH /settings/users/:guildId/:userId`
  - 既存: `speakerId` (整数), `pitch` (number), `speed` (number)
  - 追加: `llmAssistEnabled` (boolean|null)
  - 追加: `llmAssistProvider` (`gemini|openai|null`), `llmAssistApiKeyId` (string|null), `llmAssistModel` (string|null)
  - `speakerId` は VOICEVOX styles で検証。
  - `llmAssistApiKeyId` 指定時は `llmAssistProvider` 必須。
  - 旧 `llm*` フィールドは非対応（400）。
- `POST /speech`
  - `userId`, `text` は必須。
  - ユーザーと BOT が同一 VC に居るか検証し、`VoiceManager.dispatchSpeech` に渡す。
  - 話者が未指定/未設定のときはメッセージ監視と同じハッシュ規則で style ID を選ぶ。
  - LLM 設定が有効なら Discord 投稿経路と同じ前処理を適用する。
  - 409/404 を使い分けて失敗理由を返す。

## 3. 非機能要件
- Node.js 22 でコンテナ化。FFmpeg を含む。
- SQLite でデータ永続化。WAL / foreign_keys / busy_timeout=5000。
- `logs/bot.log` に INFO 以上のログを保存しつつ stdout/stderr にも出力。
- 最大発話長は `MAX_UTTERANCE_LENGTH`（初期値 140）。超過時はテキストを切り詰めて「以下略」を付与。
- LLM API キーは平文保存せず、`LLM_MASTER_KEY` を使って暗号化保存する。

## 4. 環境変数
| 変数 | 必須 | 既定 | 説明 |
| --- | --- | --- | --- |
| DISCORD_BOT_TOKEN | ✓ | - | Discord Bot ログイン用トークン。 |
| DISCORD_CLIENT_ID | Slash Command 作業時に必須 | - | REST でコマンド登録する際に使用。 |
| VOICEVOX_API_URL | ✓ | - | VOICEVOX エンジンベース URL (例: `http://voicevox_engine:50021`)。 |
| API_KEY | ✓ | - | 外部 API の `x-api-key`。 |
| LLM_MASTER_KEY | ✓ | - | base64 エンコード済み 32byte キー（AES-256-GCM）。 |
| PORT | ✓ | - | Hono API の待受ポート。 |
| API_HOST | 任意 | `0.0.0.0` | API バインドアドレス。 |
| DEFAULT_SPEAKER_ID | 任意 | `1` | ユーザー設定が無いときの VOICEVOX style ID。 |
| MAX_UTTERANCE_LENGTH | 任意 | `140` | フォーマッタと API の入力制限。 |
| DATABASE_PATH | 任意 | `<repo>/db/voicevox.db` | SQLite ファイルパス。本番は `/app/data/voicevox.db` を推奨。 |
| LOG_FILE_PATH | 任意 | `logs/bot.log` | ログ出力先。 |
| LOG_LEVEL | 任意 | `info` | `error/warn/info/debug` を指定。 |

## 5. データモデル
### user_speakers
- 主キー: `(guild_id, user_id)`
- カラム: `speaker_id INTEGER NOT NULL`, `pitch REAL DEFAULT 0`, `speed REAL DEFAULT 1`, `updated_at TEXT DEFAULT CURRENT_TIMESTAMP`

### guild_settings
- 主キー: `guild_id`
- カラム: `auto_join INTEGER DEFAULT 1`, `text_channel_id TEXT`, `updated_at TEXT DEFAULT CURRENT_TIMESTAMP`

### llm_api_keys
- 主キー: `id`
- 一意制約: `(scope, guild_id, provider, key_id)`
- カラム: `scope`, `guild_id`, `provider`, `key_id`, `encrypted_key`, `iv`, `auth_tag`, `created_by_user_id`, `created_at`, `updated_at`
- `scope = global` の場合 `guild_id = '*'`

### llm_api_key_access
- 主キー: `(api_key_pk, allowed_user_id)`
- 外部キー: `api_key_pk -> llm_api_keys.id` (`ON DELETE CASCADE`)

### user_llm_assist_settings
- 主キー: `(guild_id, user_id)`
- カラム:
  - `enabled INTEGER DEFAULT 0`
  - `provider TEXT NULL`, `api_key_id TEXT NULL`, `model TEXT NULL`
  - `updated_at TEXT DEFAULT CURRENT_TIMESTAMP`

## 6. 既知の制約
- ギルドごとに 1 VoiceSession。複数 VC へ同時参加は非対応。
- `/speech` API は BOT が接続中のギルドに限定。ギルド外のユーザーには応答できない。
- VOICEVOX API のエラーはクライアントへ返さず、ログに記録してスキップする。
- LLMアシスト第1段階のエラー/タイムアウト時は元テキストで読み上げ継続する。
- LLMアシスト第2段階または kana 再解析のエラー時は第1段階結果で読み上げ継続する。

## 7. 今後の未解決事項
- テスト自動化（現状 `npm run build` の型チェックのみ）。
- VoiceSession の同時発話をキャンセルする手段が無い。
- `/speech` API への rate limit 未実装。
