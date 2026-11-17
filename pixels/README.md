# Shopify custom pixels (source of truth)

Shopify custom pixels live in **Shopify admin → Settings → Customer events**, not in the theme.
This folder only versions their source. Shopify's GitHub theme sync ignores it; nothing here deploys automatically.

| File | Pixel |
|---|---|
| `posthog-custom-pixel.js` | "PostHog - All events" (web-pixel-176521394). Permission: Marketing + Analytics required; data sale: qualifies as data sale |

## Workflow
1. Change the file on a feature branch and open a PR.
2. Once the PR is merged **and production is approved**, paste the whole file into the pixel's Code box in Shopify admin and click **Save**. (Custom pixels are store-wide: saving changes production immediately.)
3. Check PostHog live events.

## Rollback
Paste back an earlier version of the file (`git log -- pixels/posthog-custom-pixel.js`). The first commit of this file is the code that was live on 2026-11-17 (v0, byte-identical, SHA-256 `f5ca810b…7cf67`). Shopify's "Current" version menu above the Code box also keeps earlier saves.

Only the public PostHog project key (`phc_…`) may appear here. Never commit secrets.
