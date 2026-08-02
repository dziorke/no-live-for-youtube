# Reviewer Notes

## Single purpose

The extension's only purpose is to identify and hide livestream-related videos
on YouTube and prevent those videos from entering autoplay.

## Testing instructions

1. Install the extension and open YouTube.
2. Search for `live now`; cards with a current live badge should be absent.
3. Search for archived livestreams; results labeled `Streamed ... ago` should
   be absent when **Hide past live streams** is enabled.
4. Open the toolbar popup and disable the extension; previously hidden cards
   should return after the next scan.
5. Re-enable it and verify the independent upcoming/past/autoplay toggles.

YouTube localizes badges and frequently changes renderer layouts. Detection
uses stable renderer metadata first and visible labels as a fallback.

## Permissions

- `storage` is used only for local extension preferences.
- `https://www.youtube.com/*` is the only host permission and is required to
  inspect and filter YouTube video cards and player state.

## Main-world script

`page-bridge.js` runs in the page's MAIN world because YouTube attaches the
semantic live-state values to page renderer and player objects. It only adds a
classification attribute to matching video cards and reports player state to
the isolated content script. It does not collect or transmit data.

## Remote code and data

There is no remote code, analytics, advertising, account system, or external
network request. All executable code is included in the package.
