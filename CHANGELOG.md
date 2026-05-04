# Changelog

## [1.3.0](https://github.com/BambooFury/Auto-Claim/compare/v1.2.8...v1.3.0) (2026-05-04)


### Features

* add hide owned games toggle in settings with smart badge indicator ([03de1db](https://github.com/BambooFury/Auto-Claim/commit/03de1dbb98146f3fb8d8b14c83fc3168badc659d))
* add hide owned games toggle in settings with smart badge indicator ([dd2ebab](https://github.com/BambooFury/Auto-Claim/commit/dd2ebab337abcc4b24bb9f3cc4c549aebe02a1f7))

## [1.2.8](https://github.com/BambooFury/Auto-Claim/compare/v1.2.7...v1.2.8) (2026-05-04)


### Bug Fixes

* **backend:** accumulate subid candidates across all regions ([0b9952c](https://github.com/BambooFury/Auto-Claim/commit/0b9952c50ea8425d5e5bb837e37ea0998b9cc697))
* **backend:** handle JSON null via sentinel to preserve array indices ([2a66cc7](https://github.com/BambooFury/Auto-Claim/commit/2a66cc759255be6c4cf3d1f6e0d386323184f7e1))
* **backend:** iterate scan regions when resolving free package id ([dcbeffb](https://github.com/BambooFury/Auto-Claim/commit/dcbeffbc6526f1d199d8ff21a326cb8bc7d57d22))
* **frontend:** cancel polling timers on hot-reload and unmount ([acc9f8b](https://github.com/BambooFury/Auto-Claim/commit/acc9f8bd5ac372e64746ee30aed5482b73f19bed))
* **webkit:** keep panel size stable when Scan now is pressed ([cb0064e](https://github.com/BambooFury/Auto-Claim/commit/cb0064ec6c57c6e64981c2662d3a16369f693021))
* **webkit:** persist accentColor in localStorage snapshot ([8d12e11](https://github.com/BambooFury/Auto-Claim/commit/8d12e11811d4086b350a660de6432ab0195895ac))


### Refactoring

* **backend:** remove dead IPC, encode stub, toast lock, redundant block ([2fcedf5](https://github.com/BambooFury/Auto-Claim/commit/2fcedf5a834487bf531fa3a13493c3820c9914a0))
* **frontend:** compute hue color once in HSV picker ([8b59831](https://github.com/BambooFury/Auto-Claim/commit/8b5983119f8b820e8cf6d924ad72b38461050a17))
* **frontend:** drop dead plugin-settings UI plumbing ([22cc486](https://github.com/BambooFury/Auto-Claim/commit/22cc4861ce902dae7af0f43ac2bfea6047b88efb))
* **webkit:** drop unused PluginConfig export ([0bc80bd](https://github.com/BambooFury/Auto-Claim/commit/0bc80bd535e54480b28c77384f125c455202441a))
* **webkit:** drop unused TAB_COLORS export ([e08782e](https://github.com/BambooFury/Auto-Claim/commit/e08782e605446f26efde0620f83c61f14986bbab))
* **webkit:** drop unused waitForWelcomeDismissed ([29fff50](https://github.com/BambooFury/Auto-Claim/commit/29fff50b71f52712494e15ee5d0bd321773870ed))
* **webkit:** remove dead localStorage fallback in isInLibrary ([015203c](https://github.com/BambooFury/Auto-Claim/commit/015203c2a5b2b0eeb39b6572a074e9b97bead2d9))
* **webkit:** replace brittle color replace-chain with alpha helper ([1e9571f](https://github.com/BambooFury/Auto-Claim/commit/1e9571f7fc26f80d14573373a7b5af5ca810ae67))


### Documentation

* **changelog:** remove duplicate fix entry ([136f598](https://github.com/BambooFury/Auto-Claim/commit/136f59861b701afe1ea7af728d8d637f3dc26321))


### Maintenance

* **backend:** lower pure-Lua JSON fallback log to info ([4c92edb](https://github.com/BambooFury/Auto-Claim/commit/4c92edb3a43070e4ab2f3fee324517b65c8491d7))

## [1.2.7](https://github.com/BambooFury/Auto-Claim/compare/v1.2.6...v1.2.7) (2026-05-03)


### Bug Fixes

* Windows atomic file writes and pure-Lua JSON fallback ([a3a0293](https://github.com/BambooFury/Auto-Claim/commit/a3a0293fcaee14983ef97cf2ffae31ff37fbc500))

## [1.2.6](https://github.com/BambooFury/Auto-Claim/compare/v1.2.5...v1.2.6) (2026-05-03)


### Bug Fixes

* graceful cjson fallback to prevent crash when module is unavailable ([37a05c8](https://github.com/BambooFury/Auto-Claim/commit/37a05c8d1418e755461b68dcf7ccdbf08757d7a6))

## [1.2.5](https://github.com/BambooFury/Auto-Claim/compare/v1.2.4...v1.2.5) (2026-05-03)


### Bug Fixes

* remove dead notifyOnly setting and add retry with backoff on failed scan ([db8cc42](https://github.com/BambooFury/Auto-Claim/commit/db8cc429e9b7a27433754e4e3d89dc3a92364856))
* remove widget-react.ts duplicate, fix setInterval memory leak on hot-reload ([f53a61d](https://github.com/BambooFury/Auto-Claim/commit/f53a61df5d3cfc638f431c7b1ea1f8134731f75a))
* replace regex JSON parsing with cjson, atomic file writes, region-aware cache and toast mutex ([dc596d0](https://github.com/BambooFury/Auto-Claim/commit/dc596d08d29ce456dbd091291974b865bca84f31))

## [1.2.4](https://github.com/BambooFury/Auto-Claim/compare/v1.2.3...v1.2.4) (2026-05-03)


### Bug Fixes

* Minimal Dark theme compatibility and scan result display under scan button ([3ca0f96](https://github.com/BambooFury/Auto-Claim/commit/3ca0f9626f52bdcf52dbfeed5cce52eca11b27f2))

## [1.2.3](https://github.com/BambooFury/Auto-Claim/compare/v1.2.2...v1.2.3) (2026-05-02)


### Bug Fixes

* startPolling no longer hangs when appStore is unavailable in client context ([0a64988](https://github.com/BambooFury/Auto-Claim/commit/0a64988842f818c95c41f7041a14d1bac27bbd9b))

## [1.2.2](https://github.com/BambooFury/Auto-Claim/compare/v1.2.1...v1.2.2) (2026-05-02)


### Bug Fixes

* restore tab accent, card highlight and toggle colors for Minimal Dark theme ([00e0e3f](https://github.com/BambooFury/Auto-Claim/commit/00e0e3f0b0eec1f932e0bdd742f0e82c177722a4))


### Maintenance

* minor ui and startup flow improvements ([79c4880](https://github.com/BambooFury/Auto-Claim/commit/79c4880b8a5b35e0b31130883209f214f633c26c))

## [1.2.1](https://github.com/BambooFury/Auto-Claim/compare/v1.2.0...v1.2.1) (2026-05-02)


### Documentation

* update example.png screenshot ([218da02](https://github.com/BambooFury/Auto-Claim/commit/218da02257d6e5b9205aacab85bd3021872222bd))

## [1.2.0](https://github.com/BambooFury/Auto-Claim/compare/v1.1.2...v1.2.0) (2026-05-02)


### Features

* add Scan Now button and manual scan trigger IPC ([db5321e](https://github.com/BambooFury/Auto-Claim/commit/db5321ef13df27b4047ef5fa276df0631931a0df))


### Bug Fixes

* **backend:** broaden GamerPower title regex to match all giveaway formats ([198f949](https://github.com/BambooFury/Auto-Claim/commit/198f94910404a4a61da2a0331e1871c2de084459))
* **frontend:** navigate back to previous store page after claim instead of redirecting to library ([6402ee5](https://github.com/BambooFury/Auto-Claim/commit/6402ee50f47291ee9b91daee23a25dcd958d175e))


### Performance

* **widget:** faster UI refresh and drop auto-claim on widget open ([bc20f31](https://github.com/BambooFury/Auto-Claim/commit/bc20f31b89cbfa96a3dcd1d1d2b2da3ef1cec597))

## [1.1.2](https://github.com/BambooFury/Auto-Claim/compare/v1.1.1...v1.1.2) (2026-05-01)


### Bug Fixes

* skip already grabbed games on startup to prevent duplicate notifications ([dcd0b54](https://github.com/BambooFury/Auto-Claim/commit/dcd0b543b89898cd48464be1877ffd6e04b7b8d1))

## [1.1.1](https://github.com/BambooFury/Auto-Claim/compare/v1.1.0...v1.1.1) (2026-05-01)


### Bug Fixes

* add GamerPower source and DLC filter for free games scan ([7fef284](https://github.com/BambooFury/Auto-Claim/commit/7fef28493223fe5f8c7f14af40c070a7361146f3))

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
