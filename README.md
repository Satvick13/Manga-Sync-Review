# Manga Sync Review

Public GitHub Pages PWA for the private `Manga-Sync-Bridge` repository.

It contains only browser-safe configuration:

- Supabase project URL
- Supabase publishable key
- Review and source-health UI code

It must never contain AniList tokens, manga-site cookies, passwords or the Supabase backend secret key.

## Supabase

Run `supabase-source-status.sql` from the private bridge repository if the database was created before source-health support was added.

In Supabase **Authentication → URL Configuration**, set the Site URL and an allowed Redirect URL to this GitHub Pages address.

## Notifications

The PWA shows source warnings and can issue a browser notification for a newly action-required source while the app is open or active. Closed-app push delivery needs a future push backend.
