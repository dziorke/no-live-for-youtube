# Publishing Checklist

## Before every release

- Test Chrome/Chromium, Opera GX, and the current Firefox release.
- Test Home, Search, Subscriptions, Watch recommendations, playlists, and
  autoplay.
- Test with at least English and Polish YouTube interfaces.
- Confirm the popup settings persist after a browser restart.
- Confirm no page or player information leaves the browser.
- Increment `manifest.json` and `CHANGELOG.md` together.
- Run `scripts/build.ps1` and inspect both packages.

## GitHub

1. Push the release commit.
2. Tag it using the manifest version, for example `v1.3.0`.
3. Push the tag. The release workflow builds and attaches the ZIP/XPI packages.
4. Keep the testing warning in the release notes until cross-browser testing is
   complete.

## Chrome Web Store

- Upload the Chromium ZIP from `dist/`.
- Use `store-listing/LISTING.md` for the listing copy.
- Upload `assets/icons/icon128.png` as the store icon.
- Upload `store-assets/promo-small-440x280.png`.
- Upload both 1280x800 screenshots from `store-assets/`.
- Declare the single purpose and permission explanations from reviewer notes.
- Link `PRIVACY.md` through the repository's public URL.
- Use deferred publishing after review for a final smoke test.

## Opera Add-ons

- Upload the Chromium ZIP.
- Reuse the listing copy, icon, and screenshots.
- Choose Productivity and the MIT license.
- Include the testing notice in the description.
- Provide the GitHub Issues URL as the support page.

## Firefox Add-ons (AMO)

- Upload the Firefox XPI from `dist/`.
- Keep the Gecko add-on ID unchanged across releases.
- Keep minimum versions at Firefox 140 desktop and Firefox 142 Android while
  using Mozilla's built-in no-data-collection declaration.
- Declare no data collection; settings use local storage only.
- Use `store-listing/REVIEW_NOTES.md` as the basis for reviewer notes.
- Keep the source repository public and provide the matching release tag.

Store accounts, agreements, fees, and final submission buttons must be handled
by the publisher account owner.
