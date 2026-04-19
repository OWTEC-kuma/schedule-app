This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

Create a local `.env.local` using the example:

```bash
cp .env.example .env.local
```

Edit `.env.local` to point `SAVED_DATA_DATABASE_URL` at the database you want to use for saved app data.
If you need a separate value for the app itself, set `DATABASE_URL` too; otherwise `DATABASE_URL` is used as a fallback.

Then run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

This app now requires login before accessing the main schedule UI. Use the credentials defined in `.env.local`:

- `AUTH_USERNAME`
- `AUTH_PASSWORD`

### 本番公開の環境変数設定

本番公開では、次の環境変数をホスティングサービスの管理画面で設定してください。

- `DATABASE_URL` - アプリが使う PostgreSQL 接続文字列。最低1つは設定が必要です。
- `SAVED_DATA_DATABASE_URL` - 保存データ専用 DB を分けたい場合に設定します。
  - この値が設定されている場合、アプリは `SAVED_DATA_DATABASE_URL` を優先して使います。
  - `SAVED_DATA_DATABASE_URL` が未設定なら、`DATABASE_URL` が自動的に使われます。
- `AUTH_USERNAME` - 管理者ログインユーザー名
- `AUTH_PASSWORD` - 管理者ログインパスワード
- `AUTH_SESSION_SECRET` - セッション署名用の長くランダムな値
- `AUTH_SESSION_MAX_AGE` - セッション有効期限（秒）。例: `86400`
- `AUTH_SESSION_SECURE` - セッション Cookie の Secure 属性。
  - HTTPS 本番環境では `true` にしてください。
  - ローカル HTTP で動かす場合は `false` に設定します。
- `LOCK_MINUTES` - プロジェクト編集ロックタイムアウト（分）

> 本番では `AUTH_SESSION_SECRET` を必ず強いランダム値にして、公開リポジトリやログに含めないでください。

> 本番運用では、`NODE_ENV=production` と HTTPS を使い、`AUTH_SESSION_SECURE=true` にしておくことを推奨します。

### デプロイ準備

1. `npm run build` でビルドが成功することを確認します。
2. ホスティング側で `NODE_ENV=production` が設定されることを確認します。
3. 本番 DB への接続情報を `DATABASE_URL` / `SAVED_DATA_DATABASE_URL` に設定します。
4. 認証情報を `AUTH_USERNAME` / `AUTH_PASSWORD` / `AUTH_SESSION_SECRET` に設定します。
5. `AUTH_SESSION_MAX_AGE` を設定するとログイン保持時間を調整できます。
6. 本番環境では `AUTH_SESSION_SECURE=true` を設定してください。

このアプリではログイン状態を Cookie で保持するため、ブラウザ側で Cookie が残っている間は再ログイン不要です。

### Production deployment example

#### Docker

1. `cd app`
2. `docker build -t owtec-schedule .`
3. `docker run -d -p 3000:3000 \
  -e NODE_ENV=production \
  -e DATABASE_URL=your_database_url \
  -e AUTH_USERNAME=admin \
  -e AUTH_PASSWORD=your_password \
  -e AUTH_SESSION_SECRET=your_strong_secret \
  -e AUTH_SESSION_MAX_AGE=86400 \
  -e AUTH_SESSION_SECURE=true \
  -e LOCK_MINUTES=5 \
  owtec-schedule`

#### Docker Compose example

1. `cd app`
2. `docker-compose up -d`

This project includes a sample `docker-compose.yml` for a local production-like setup with PostgreSQL.

- Create a `.env` file in `app/` with your production values:
  - `DATABASE_URL`
  - `SAVED_DATA_DATABASE_URL` (optional)
  - `AUTH_USERNAME`
  - `AUTH_PASSWORD`
  - `AUTH_SESSION_SECRET`
  - `AUTH_SESSION_MAX_AGE`
  - `AUTH_SESSION_SECURE=true`
  - `LOCK_MINUTES`

#### HTTPS and secure cookies

- 本番では必ず HTTPS を使ってください。
- `AUTH_SESSION_SECURE=true` にすると、Cookie は Secure 属性付きになり、HTTPS 上でのみ送信されます。
- HTTP での動作確認時は `AUTH_SESSION_SECURE=false` を使いますが、本番では無効化しないでください。
- リバースプロキシ（nginx や Caddy など）を使う場合、プロキシ先は `http://127.0.0.1:3000` で構いません。

### ローカルと本番の使い分け

- ローカル開発: `.env.local` に `AUTH_SESSION_SECURE=false`
- 本番環境: `AUTH_SESSION_SECURE=true` と `NODE_ENV=production`

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!
