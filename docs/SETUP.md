# House Tracker: setup guide

This takes about 20 minutes. You will:

1. Merge the code into `main` on GitHub
2. Create the database on **Supabase** (free)
3. Put the app online with **Cloudflare Pages** (free)
4. Install it on both iPhones

You never need to paste any password or secret key into a chat. The only two values you copy are the **Project URL** and the **Publishable (anon) key**, and both are safe to be public: your data is protected by the security rules in the database.

---

## Step 1: Merge the code on GitHub

1. Open the pull request link you were sent (or go to `github.com/itsBorror/house-tracker` → **Pull requests** tab → click the open one).
2. Scroll down and click the green **Merge pull request** button, then **Confirm merge**.

Cloudflare builds the app from `main`, so do this first.

---

## Step 2: Create the database on Supabase

### 2.1 Sign up

1. Go to **https://supabase.com** and click **Start your project** (top right).
2. Click **Continue with GitHub** (easiest, you already have GitHub) and approve. Or sign up with email and confirm it.

### 2.2 Create a project

1. Click **New project**. If asked for an organization, keep the default one (or create one called `Personal`, plan **Free**).
2. Fill in:
   - **Project name:** `house-tracker`
   - **Database password:** click **Generate a password**, then save it in your password manager. The app does not need it, but keep it safe.
   - **Region:** `Central EU (Frankfurt)` or `West EU (Paris)` (closest to Tunisia)
3. Click **Create new project** and wait 1–2 minutes until the dashboard is ready.

### 2.3 Create the tables (run the SQL)

1. On GitHub, open the file `supabase/schema.sql` in the `house-tracker` repo and click the **Copy raw file** button (the two-squares icon at the top right of the file).
2. In Supabase, click **SQL Editor** in the left sidebar (icon looks like `>_`).
3. Click **+ New query** (or the **+** next to the tabs).
4. Paste everything into the big editor and click **Run** (bottom right, or Ctrl/Cmd + Enter).
5. You should see **Success. No rows returned**. If Supabase shows a warning about "destructive operations", click **Run this query** to confirm (the script only drops and re-creates its own security rules).

That one script creates all the tables, the security rules (only you two can see your data), live sync, and private photo storage.

### 2.4 Email login settings

1. Left sidebar → **Authentication** → **Sign In / Providers** (under *Configuration*).
2. Make sure **Email** is enabled.
3. Turn **off** "**Confirm email**" and click **Save**. This lets you sign in right away without waiting for an email. (Your data is still private: nobody can see your house without your join code.)

### 2.5 Copy your two keys

1. Click the **Connect** button at the top of the dashboard, or go to **Project Settings** (gear icon at the bottom left) → **API Keys**.
2. Copy and keep these two values in a note for the next step:
   - **Project URL**: looks like `https://abcdefghijklm.supabase.co` (also shown under **Project Settings → Data API**)
   - **Publishable key**: starts with `sb_publishable_…`. If you only see the **Legacy API keys** tab, copy the **anon public** key instead (a long text starting with `eyJ…`).

> ⚠️ Never copy the **secret** key or the **service_role** key anywhere. The app does not need them.

---

## Step 3: Put the app online with Cloudflare Pages

### 3.1 Sign up

1. Go to **https://dash.cloudflare.com/sign-up**, enter your email and a password, click **Sign up**.
2. Open the verification email from Cloudflare and click the link.
3. If Cloudflare asks what you want to do first, you can skip it (click **Skip** or go straight to the dashboard).

### 3.2 Connect GitHub

1. In the left sidebar click **Compute (Workers)** → **Workers & Pages**.
2. Click the blue **Create** button (or **Create application**).
3. Choose the **Pages** tab, then **Import an existing Git repository** → **Get started**.
   (If you only see Workers options, look for the small link **"Looking to deploy Pages? Get started"** at the bottom.)
4. Click **Connect GitHub**. A GitHub window opens:
   - Choose **Only select repositories** → pick **house-tracker**
   - Click **Install & Authorize**
5. Back in Cloudflare, select **house-tracker** and click **Begin setup**.

### 3.3 Build settings

Fill in exactly:

| Setting | Value |
|---|---|
| Project name | `house-tracker` (this becomes `house-tracker.pages.dev`; if taken, try `house-tracker-tn`) |
| Production branch | `main` |
| Framework preset | `React (Vite)` (or `None`) |
| Build command | `npm run build` |
| Build output directory | `dist` |

### 3.4 Environment variables

Still on the same page, open **Environment variables (advanced)** and click **+ Add variable** twice:

| Variable name | Value |
|---|---|
| `VITE_SUPABASE_URL` | your **Project URL** from step 2.5 |
| `VITE_SUPABASE_ANON_KEY` | your **Publishable** (or **anon public**) key from step 2.5 |

Then click **Save and Deploy**. Wait 1–2 minutes until it says **Success**, and click the link (`https://house-tracker.pages.dev`).

> Forgot the variables, or changed them later? Go to your Pages project → **Settings** → **Variables and Secrets** → add them → then **Deployments** tab → on the latest deployment click **⋯** → **Retry deployment**. The app only picks up variables when it is rebuilt.

### 3.5 Tell Supabase your app's address

This makes "Forgot password" emails open your app.

1. Supabase → **Authentication** → **URL Configuration**.
2. **Site URL:** `https://house-tracker.pages.dev` (your real address) → **Save**.
3. Under **Redirect URLs** click **Add URL**, enter `https://house-tracker.pages.dev/**` → **Save URLs**.

---

## Step 4: Install on both iPhones

### You (first)

1. Open **Safari** on the iPhone (it must be Safari) and go to `https://house-tracker.pages.dev`.
2. Tap **Create an account**, enter your email and a password.
3. Tap **Create our house**, type a name and your first name, then **Create**.
4. Tap the **Share** button (square with an arrow) → scroll down → **Add to Home Screen** → **Add**.
5. Open the app from the new icon. In **Home → ⚙︎ Settings** you'll see your **Invite code** (6 letters). Tap it to share it with your wife.

### Your wife

1. Safari → same address → **Create an account** with her own email and password.
2. Tap **Join with a code**, enter the 6-letter code and her name, then **Join**.
3. **Share** → **Add to Home Screen** → **Add**.

Done. Anything one of you saves shows up on the other phone within a second or two (or as soon as the phone is back online).

### Optional: lock the door

Once you both have accounts, go to Supabase → **Authentication** → **Sign In / Providers** and turn **off** "**Allow new users to sign up**" → **Save**. Nobody else can create an account after that. (A house also never accepts more than two members.)

---

## Good to know

- **Offline:** everything you add is saved on the phone first and syncs automatically when you're back online. Settings shows how many changes are waiting.
- **Free plan pause:** Supabase pauses free projects after 7 days without any use. Using the app regularly prevents it. If it ever happens, open supabase.com → your project → **Restore project**. Nothing is lost.
- **Backups:** Settings → **Back up all data (JSON)** saves a file you can keep in iCloud Drive. **Restore from backup** loads it again.
- **Updates:** every time new code is merged into `main` on GitHub, Cloudflare rebuilds the app automatically. The iPhone app picks up the new version the next time it's opened.
- **Your amounts:** nothing is pre-filled. You enter your supplier total, monthly payment and worker prices in the app (Debt and Workers tabs).

## Running it on a computer (optional, for developers)

```bash
npm install
cp .env.example .env.local   # then put your URL and key in it
npm run dev
```
