# Changelog

## [1.1.0](https://github.com/BambooFury/Auto-Claim/compare/1.0.1...v1.1.0) (2026-05-01)


### Features

* add accent color setting ([02fb860](https://github.com/BambooFury/Auto-Claim/commit/02fb86021c9d8fc87f33a2144c0372bb6d78afe7))
* add HSV color picker component ([8283f72](https://github.com/BambooFury/Auto-Claim/commit/8283f722fd32f4703a2c436515f0c8f8a40f0627))


### Bug Fixes

* add reset to defaults button in settings ([76f97d4](https://github.com/BambooFury/Auto-Claim/commit/76f97d46cc95708ae879853f066e8799d3d0f8d5))
* update plugin subtitle text ([833fea1](https://github.com/BambooFury/Auto-Claim/commit/833fea196b2b068ce1502548d18dbfcfbbd0b7ab))

## [1.0.1](https://github.com/BambooFury/Auto-Claim/compare/1.0.0...v1.0.1)

### Features

- Toast notification when widget silently claims a game (IPC bridge webkit→backend→frontend)
- Active Millennium logger forwarding all `[AutoClaim]` plugin messages to Millennium logs
- Setting-change traces for scan interval, auto-add and notify-on-grab toggles

### Bug Fixes

- Free-games cache no longer keeps expired promotions (e.g. games stuck in widget after promo ended)
- Logger prefix consistently uses `[AutoClaim]` (was still `[FreeGameGrabber]` in one place)

### Refactoring

- Removed manual **Scan** button and skeleton loading UI from widget
- Replaced gift placeholder in empty state with animated radar icon
- Updated scan intervals from `15 / 30 / 60 min` to `30 / 60 / 120 min` with auto-migration

### Documentation

- README updated for the new scan interval values
- Welcome modal text now matches new defaults

## [1.0.0](https://github.com/BambooFury/Auto-Claim/releases/tag/1.0.0)

Initial release.
