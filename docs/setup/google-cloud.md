# Google setup (one time, about 5 minutes)

The app talks to Google from your phone, so Google needs to know the app. This creates a free OAuth client in your own Google Cloud project. No billing, no server.

## 1. Create a project

1. Open <https://console.cloud.google.com/> signed in as `sagiveliya@gmail.com`.
2. Project picker (top bar) → **New project** → name it `Notebook` → **Create**, then select it.

## 2. Turn on the three APIs

In **APIs & Services → Library**, search for each and press **Enable**:

- Google Calendar API
- Google Drive API
- Gmail API (only used if you turn on the "Starred in Gmail" block)

## 3. Consent screen

1. **APIs & Services → OAuth consent screen** (also shown as **Google Auth Platform**) → **Get started**.
2. App name `Notebook`, support email = your email → Audience **External** → contact email → **Create**.
3. **Audience** → under *Test users* → **Add users** → `sagiveliya@gmail.com` → Save. Leave the app in **Testing**; that is fine for personal use.

## 4. Create the client ID

1. **Clients** (or **Credentials → Create credentials → OAuth client ID**).
2. Application type **Web application**, name `Notebook web`.
3. **Authorized JavaScript origins:** add `https://sagive99.github.io` and, for local development, `http://localhost:5173`.
4. No redirect URIs are needed. **Create**, then copy the **Client ID** (it ends in `.apps.googleusercontent.com`). It is not a secret.

## 5. Give it to the deployment

1. GitHub → `sagive99/notebook` → **Settings → Secrets and variables → Actions → Variables** → **New repository variable**.
2. Name `GOOGLE_CLIENT_ID`, value = the client ID.
3. **Actions → Deploy to GitHub Pages → Run workflow** (or push to `main`).

For local development, put the same value in `apps/web/.env.local` as `VITE_GOOGLE_CLIENT_ID=...` and run `pnpm dev`.

## 6. On the iPhone

1. Open <https://sagive99.github.io/notebook/> in **Safari** → Share → **Add to Home Screen**.
2. Open it from the home screen → **Connect**. Google shows "Google hasn't verified this app" because it is in Testing: tap **Continue**, allow Calendar and Drive app data.
3. To see app reminders in the iPhone Calendar app: iPhone **Settings → Calendar → Accounts → Add Account → Google**, same account, Calendars on.

After about an hour without use, the app asks you to tap **Reconnect** once ([why](../adr/0004-browser-oauth-token-model.md)). Your notebook stays usable meanwhile.
