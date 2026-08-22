# Manga Sync Review

Manga Sync Review is the public GitHub Pages PWA used with the private `Manga-Sync-Bridge` repository.

It provides two functions after Supabase sign-in:

- Review and confirm low-confidence AniList matches.
- See the connection state of AniList, MangaDex, MangaFire, Comix, ComicK and Supabase.

The app is installable on supported desktop and mobile browsers.

## Security boundary

This public repository contains only browser-safe configuration and code:

- Supabase project URL
- Supabase publishable/anon key
- Review, connection-status and notification UI

It must never contain:

- AniList access tokens
- MangaFire or Comix cookies
- MangaDex credentials
- ComicK credentials
- `SUPABASE_KEY`, a Supabase secret key or a service-role key

Row Level Security in Supabase ensures a signed-in user can read only rows belonging to that user's UUID.

## Required Supabase setup

For a new database, run `supabase.sql` from the private bridge repository.

For a database created before source-health support was added, run:

```text
supabase-source-status.sql
```

This adds the `source_status` table without deleting existing mappings or pending reviews.

In Supabase **Authentication → URL Configuration**:

1. Set the Site URL to the published GitHub Pages URL.
2. Add the same Pages URL to the allowed Redirect URLs.
3. Make sure the intended email already has a Supabase Auth user; the app does not create new users automatically.

After signing in, the app displays the Supabase owner UUID. Store that exact value as `SUPABASE_OWNER_ID` in the private bridge repository's GitHub Actions secrets.

## GitHub Pages

Publish this repository from the `main` branch and repository root.

The app requires these files:

```text
index.html
manifest.webmanifest
service-worker.js
icon.svg
```

After a deployment, a previously installed version may briefly use its cached shell. Reopen or refresh it to load the newest service worker and UI.

## Source health

The private bridge writes one status row per source after a workflow run. The app displays:

- Connected
- Not configured
- Sign-in required
- Blocked
- Rate limited
- Warning
- Error
- Awaiting first run

MangaFire and Comix warnings tell the user when the corresponding GitHub secret cookie may need refreshing. A persistent HTTP 403 is shown separately because it may be Cloudflare blocking a GitHub-hosted runner rather than an expired cookie.

ComicK is expected to use an explicit official `comick.dev` history endpoint. The private bridge refuses `comick.live`, `comick.io` and unrelated hosts. Until `COMICK_HISTORY_URL` is configured with a working `comick.dev` JSON endpoint, ComicK appears as **Not configured**.

## Browser notifications

Select **Enable notifications** in the app. A notification is issued once for each new source problem that the bridge marks as `action_required`.

The current implementation can notify while the PWA is open, installed or active. A completely closed app cannot receive a remote push because this project deliberately has no push server or subscription backend yet.

Cookies, passwords and access tokens are never sent to this PWA or included in notification text.

## Manual match review

For each pending item, the app shows the source title, chapter, suggested AniList title, author evidence, cover and confidence score.

You can:

- Open the suggested AniList page.
- Enter a different AniList manga ID.
- Confirm the mapping for future syncs.
- Reject the suggested match.

Confirming a mapping does not itself change AniList. The next live bridge run uses the saved mapping and applies only a non-decreasing progress/status update.

## Troubleshooting

### Source-health migration notice

Run `supabase-source-status.sql` in Supabase SQL Editor, then run the private bridge workflow once and refresh this app.

### Magic link returns to the wrong page

Correct the Supabase Site URL and allowed Redirect URL so they match the exact GitHub Pages address, including the repository path.

### No connection records appear

Run the bridge workflow once with `SUPABASE_URL`, `SUPABASE_KEY` and `SUPABASE_OWNER_ID` configured. A dry run can record source health without changing AniList.

### No pending matches appear

Pending-review rows are created only when a non-dry live run encounters a match below the automatic confidence threshold. Exact source-provided AniList IDs and high-confidence matches do not enter the queue.
