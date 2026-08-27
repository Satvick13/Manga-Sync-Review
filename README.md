# Manga Sync Review

Manga Sync Review is the public GitHub Pages PWA used with the private `Manga-Sync-Bridge` repository.

After Supabase sign-in it provides three functions:

- **Reading History** for Manga Sync catalogue items, including WEBTOON-only series.
- **Reading / Dropped / Completed** controls. Explicit status changes are queued for the private bridge; linked AniList entries are updated on the next live bridge run.
- Review of genuinely uncertain AniList matches plus connection health for each source.

The app is installable on supported desktop and mobile browsers.

## Security boundary

This public repository contains only browser-safe configuration and UI code. It must never contain AniList tokens, manga-site cookies/passwords, MangaDex credentials, ADB data, or a Supabase service-role key.

Row Level Security in Supabase ensures a signed-in user can read only rows belonging to that user's UUID. The PWA can update the status fields of an existing catalogue item but cannot create or delete catalogue/progress records.

## Required Supabase setup

For the original mapping/review tables, run `supabase.sql` from the private bridge repository.

For source-health support, run:

```text
supabase-source-status.sql
```

For Reading History, WEBTOON-only tracking and the Reading/Dropped/Completed controls, also run:

```text
supabase-webtoon-catalog.sql
```

These migrations do not delete existing mappings or pending reviews.

In Supabase **Authentication → URL Configuration** set the Site URL and allowed Redirect URL to the published GitHub Pages address. After signing in, copy the displayed owner UUID to `SUPABASE_OWNER_ID` in the private bridge repository.

## Reading History

The Reading History section reads `catalog_items` plus `source_progress` from Supabase. A work does not need an AniList entry to appear here.

WEBTOON-only items can therefore retain:

- WEBTOON title and cover
- creators
- description/genres where WEBTOON metadata resolution has completed
- last-read episode/label and capture time
- `Reading`, `Dropped` or `Completed` status

Available filters include All, Reading, Dropped, Completed and WEBTOON only.

### Status model

The user-facing status model deliberately contains only:

```text
Reading
Dropped
Completed
```

`Reading` maps to AniList `CURRENT` only inside the private bridge. There is no Paused status in Manga Sync.

Selecting **Drop**, **Resume**, **Resume reading** or **Complete** updates the internal catalogue immediately and marks the row for private bridge processing. If the work is linked to AniList, the next live bridge run applies the corresponding AniList status. If it is WEBTOON-only, the status remains entirely within Manga Sync.

## WEBTOON Android history

WEBTOON history is collected by the private repository using Android Debug Bridge while the phone is unlocked on **WEBTOON → MY → RECENT**. The public PWA never talks to the phone and never receives WEBTOON login credentials.

The private collector stores a local snapshot, and scheduled bridge runs import that snapshot into the internal catalogue. WEBTOON public pages are used gradually for cover/creator/description metadata; metadata lookup is cached so unresolved niche/Canvas works continue to be trackable without repeated searches.

## Source health

The Connections section shows AniList, MangaDex, MangaFire, Comix, Comick.dev, Comick.live, WEBTOON and Supabase independently. Authentication or Cloudflare failures are reported without exposing cookies/tokens.

## Manual match review

The review queue is for ambiguous mappings, not merely for titles absent from AniList. WEBTOON-only works should stay in Reading History rather than flooding `Matches requiring review`.

For each pending item the app can show the source title/chapter, suggested AniList candidate, cover and confidence. Confirming a mapping saves it for future private bridge runs; it does not expose or use the AniList token in this public app.

## GitHub Pages

Publish from the `main` branch and repository root. Core files are:

```text
index.html
manifest.webmanifest
service-worker.js
webtoon-history.js
icon.svg
```

After deployment, reopen or force-refresh a previously installed PWA once so the newest service worker/cache is active.
