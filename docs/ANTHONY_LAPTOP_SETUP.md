# Anthony's New Laptop Setup (Windows 11)

This assumes a genuinely brand-new machine — nothing installed, terminal never opened before. Don't skip steps because "that's probably already there." Do these in order. Total time: ~45-60 minutes.

## 0. Before anything else — turn off OneDrive folder backup

New Windows setups often prompt to back up your Desktop/Documents/Pictures to OneDrive. **Say no, or turn it off if it's already on**, for the folder you'll use in step 6. This actually broke things on Shane's own machine before (`git` failing with `mmap failed`, the site's dev server crashing with `EINVAL readlink`) — OneDrive syncing files while a program is using them causes real, confusing errors.

Check now: Settings → Accounts → "Windows backup" (or search "Backup" in Start) → make sure Documents/Desktop aren't being backed up to OneDrive. If they are, turn it off, or just make sure to use a folder outside Documents in step 6 (e.g. `C:\Projects`).

## 1. Install Git for Windows

Download and run the installer: https://git-scm.com/download/win
Accept all the defaults during install — this also gives you a proper terminal (Git Bash) that Claude Code can use.

If Windows shows a blue "Windows protected your PC" popup when you run the installer, click **More info**, then **Run anyway** — this is normal for installers downloaded from the web, not a sign anything's wrong.

**Close and reopen PowerShell after this step** so it picks up the new install.

## 2. Install Node.js

Download the **LTS** version: https://nodejs.org
Accept all the defaults. This is needed to run the website locally (`npm install`, `npm run dev`).

**Close and reopen PowerShell after this step too.**

## 3. Install Claude Code

Open **PowerShell** (Start menu → type "PowerShell" → Enter), paste this, press Enter:

```powershell
irm https://claude.ai/install.ps1 | iex
```

Wait for it to finish, then confirm it worked:

```powershell
claude --version
```

If that doesn't show a version number, close PowerShell completely and open a new window, then try again.

## 4. Log into Claude Code with your OWN account

You need your own Claude.ai account (Pro or Max plan) — not Shane's. This is what makes you independent; if you're ever logged in as someone else, stop and fix that first.

```powershell
claude
```

The first time you run it, it opens your browser to log in. Sign in (or sign up) with your own Claude.ai account.

## 5. Push access on GitHub

Before this step, confirm with Shane which GitHub login you're using — see `ANTHONY_HANDOFF.md` item #1, this needs to be settled first (either you get real control of the `Ajmfit88` account, or you set up a brand new one of your own). Once you know which account, set your name/email:

```powershell
git config --global user.name "Anthony Martin"
git config --global user.email "anthony@ajmfit.com"
```

The first time you `git push` from this new machine, a browser window *should* pop up asking you to log into GitHub — sign in there with your account. **If no browser window appears after a minute or two**, that's a known issue on some setups (it happened before) — don't keep retrying. Instead, get a personal access token from your GitHub account (Settings → Developer settings → Personal access tokens) and tell Claude Code you need to set the git remote to use it — it can walk you through the exact command.

## 6. Clone the website

Use a folder **outside** Documents/Desktop (see step 0 — avoids the OneDrive bug):

```powershell
mkdir C:\Projects
cd C:\Projects
git clone https://github.com/atlasmindsco/AJMFit.git "AJM FIT"
cd "AJM FIT"
```

## 7. Install dependencies

```powershell
npm install
```

This takes a few minutes the first time. If you see red text, don't panic — copy it and ask Claude Code (step 11) what it means.

## 8. Add your environment variables

Shane will send you a file with all the API keys/passwords the site needs (Stripe, Supabase, Kit, etc. — see `ANTHONY_HANDOFF.md` for how that gets to you securely, never over chat or email). It needs to end up as a file named exactly `.env.local` in this same `AJM FIT` folder. Two ways to do that:

**If you received it as a file already** (e.g. a password manager attachment): download it, then rename it to exactly `.env.local` and move it into the `C:\Projects\AJM FIT` folder. Windows hides file extensions by default, which makes renaming to a dot-file confusing — in File Explorer, click **View → Show → File name extensions** first so you can see (and correctly remove) any `.txt` that might get added.

**If Shane pastes the contents to you directly** (e.g. reads it out via a password manager share):
1. Open **Notepad**.
2. Paste in everything he sends you.
3. **File → Save As.**
4. Navigate to `C:\Projects\AJM FIT`.
5. Where it says "Save as type," change it to **All Files** (not "Text Documents") — this matters, otherwise Notepad silently appends `.txt` and the file won't work.
6. Type the filename as exactly `.env.local` (including the leading dot) and save.

This file is intentionally never uploaded to GitHub — keep it private, don't email it onward, don't paste it into a chat.

## 9. Run the site locally

```powershell
npm run dev
```

Open http://localhost:3000 in your browser — you should see the live site running on your machine.

## 10. Install the Vercel CLI (for deploying)

```powershell
npm install -g vercel
vercel login
```

Log in with your own Vercel account once you've been added to the AJM FIT team (see `ANTHONY_HANDOFF.md` item #2 — this one's still pending on Shane's end). Then link this folder to the project:

```powershell
vercel link
```

Note: you don't strictly need this to ship changes — pushing to GitHub already auto-deploys the live site (see `ANTHONY_HANDOFF.md` #2). This is only for direct/manual deploys and seeing logs yourself.

## 11. Start working with Claude Code

From inside the `AJM FIT` folder:

```powershell
claude
```

Claude Code will read this repo's `CLAUDE.md` file automatically and follow the project's own rules (design workflow, screenshot checks, etc.) — you don't need to explain anything, just tell it what you want done.

### A few things to know

- The first time Claude Code opens a new project folder, it asks you to confirm you trust it — say yes, it's your own repo.
- Press `Shift+Tab` to switch how much it asks permission before making changes.
- Type `/login` anytime you need to switch which Claude account you're using.
- If something breaks and you're not sure why, just tell Claude Code what happened — it can look at the error and figure it out.
