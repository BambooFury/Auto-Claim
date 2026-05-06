# Changelog

## [1.4.0](https://github.com/BambooFury/Auto-Claim/compare/v1.3.6...v1.4.0) (2026-05-06)


### Features

* **settings:** add configurable indicator color with 5 presets and custom palette ([2ece4ea](https://github.com/BambooFury/Auto-Claim/commit/2ece4eaac665cefa8c64567a5bb6812f5d37c3e5))
* **welcome:** add filter feature row and bump SEEN_FLAG to v3 ([1a9d663](https://github.com/BambooFury/Auto-Claim/commit/1a9d663882314206f87737009bfb54b40716d1b5))
* **widget:** add Games/All filter with type-aware classification ([4d39ae1](https://github.com/BambooFury/Auto-Claim/commit/4d39ae15606ca79a817c51e82df53549dcbf6bf5))
* **widget:** add pulsing notification indicator on tab arrow for unc… ([89161bf](https://github.com/BambooFury/Auto-Claim/commit/89161bf4f7aac1ff6eb1b9799a2c766d4235ef7d))
* **widget:** add pulsing notification indicator on tab arrow for unclaimed free games ([6f11ab6](https://github.com/BambooFury/Auto-Claim/commit/6f11ab60a97b2a5c1aabc29cc96adc67327e53e5))


### Bug Fixes

* **backend:** tighten input validation across IPC save handlers ([653ab1f](https://github.com/BambooFury/Auto-Claim/commit/653ab1fea5e9820b88adfd1a2de76b37b908fee1))
* **plugin:** route initial scan through triggerScan to avoid losing user scan requests at startup ([800a178](https://github.com/BambooFury/Auto-Claim/commit/800a178a5d1b7eee12266cec30da0b908055ee53))
* **plugin:** suppress notifications for non-game free items (DLC, music, demo) ([7339338](https://github.com/BambooFury/Auto-Claim/commit/73393384805b5c76df0ba2a733220d6453c84af7))
* **webkit:** validate claim response in silentClaim to avoid false-positive ownership ([4f9a2f8](https://github.com/BambooFury/Auto-Claim/commit/4f9a2f8d7e6f3489cb657dd8798d9396a0041f3c))
* **widget:** refresh new-game indicator on unchanged cache polls ([bb0580d](https://github.com/BambooFury/Auto-Claim/commit/bb0580d60bc8639bdab4dc635b6d10d71686bf6b))
* **widget:** stop card flicker by skipping full re-render on unchanged cache ([675318e](https://github.com/BambooFury/Auto-Claim/commit/675318e6490c797b7308c5a85b3edeb6327f822d))

## [1.3.6](https://github.com/BambooFury/Auto-Claim/compare/v1.3.5...v1.3.6) (2026-05-05)


### Bug Fixes

* wrap http calls in pcall to prevent crash, queue concurrent scan requests ([fe2ad32](https://github.com/BambooFury/Auto-Claim/commit/fe2ad321ad7dceab860b107bb1cd4deab49fa246))

## [1.3.5](https://github.com/BambooFury/Auto-Claim/compare/v1.3.4...v1.3.5) (2026-05-04)


### Bug Fixes

* **backend:** make pop_toasts_ipc atomic against concurrent push ([149f1a1](https://github.com/BambooFury/Auto-Claim/commit/149f1a1dc3d1475511dbeca58ea7706b64e6b83d))
* **backend:** parse addfreelicense response as JSON instead of substring matching ([fda6501](https://github.com/BambooFury/Auto-Claim/commit/fda65018d1936c7131a3c236f59d0efece4a86e4))
* **backend:** rewrite _extract_subid_from_appdetails via JSON walk ([3cd8734](https://github.com/BambooFury/Auto-Claim/commit/3cd87346fe3030aae90829545a5618f20a1f6214))
* **backend:** validate JSON shape in save_*_ipc handlers ([cebc33e](https://github.com/BambooFury/Auto-Claim/commit/cebc33ed5ecd82c196a739e66059bdb7f78711dd))
* **frontend:** narrow SCAN_NAME_BLOCKLIST so real games are not skipped ([afcf637](https://github.com/BambooFury/Auto-Claim/commit/afcf63770afbe5fc1542d1ec05cbb3bd6e364af3))
* **frontend:** reduce false positives in isAlreadyInLibrary ([5b15db1](https://github.com/BambooFury/Auto-Claim/commit/5b15db1a8f168f213b89b1c031d5aa07aeb8036d))
* **plugin:** per-appid cross-process claim lock to avoid duplicate claims ([6af167f](https://github.com/BambooFury/Auto-Claim/commit/6af167ff0c2e1c7c1c5d8ae79057675b3a5e79a7))
* **webkit:** drop install/play tokens from BTN_KEYWORDS (per Codex review) ([34632f6](https://github.com/BambooFury/Auto-Claim/commit/34632f6af7e258af31f45c83eff0d85de81cdddc))
* **webkit:** drop loose data-ds-packageid regex that could match paid subs ([4f3e1b5](https://github.com/BambooFury/Auto-Claim/commit/4f3e1b5637ddfd74b31882525661fce2265282e1))
* **webkit:** require steamLoginSecure before persisting cookies ([4e4ed28](https://github.com/BambooFury/Auto-Claim/commit/4e4ed28fd0ae6a853b260790ad55f406db808794))
* **webkit:** tighten BTN_KEYWORDS to avoid clicking paid buttons ([9adc68d](https://github.com/BambooFury/Auto-Claim/commit/9adc68d6f96d6a649dc8521ecde1a5f425a8ec84))
* **webkit:** tighten BTN_KEYWORDS to avoid clicking paid buttons ([e427d69](https://github.com/BambooFury/Auto-Claim/commit/e427d69190a9a3e2fc93308f400c94e5faef1cb8))
* **welcome-modal:** remove keydown listener on page unload ([12f470d](https://github.com/BambooFury/Auto-Claim/commit/12f470d9cbf7d08e97baf7d92beb3b311d8d9d29))
* **widget:** include game name when checking cache change in softRefresh ([1a15cfc](https://github.com/BambooFury/Auto-Claim/commit/1a15cfcfde675259b16f099d2b59779d665f9c7c))
* **widget:** poll cache for scan result instead of hardcoded 8s wait ([b82ea82](https://github.com/BambooFury/Auto-Claim/commit/b82ea82830d0cd6170ebb23e7e2158446f4731a0))
* **widget:** re-check ownership before each claim attempt ([ac03265](https://github.com/BambooFury/Auto-Claim/commit/ac03265172f0d5c6c29330fe5825a5dee7622c11))
* **widget:** use backend scan_done counter to detect Scan now completion ([08c3f8d](https://github.com/BambooFury/Auto-Claim/commit/08c3f8d57026a5e852aff96945b30efc4cfdba64))


### Performance

* **backend:** cut SEARCH_REGIONS to us/de/tr and bump frontend scan timeout to 60s ([a4601db](https://github.com/BambooFury/Auto-Claim/commit/a4601db4119b80d162d6adc7101a2a8f668d437d))
* **backend:** memoize load_cookie_header for 30s ([8533fd2](https://github.com/BambooFury/Auto-Claim/commit/8533fd2bc3c0f3c8f83148463882094c3b4e3c9c))
* **frontend:** cap addViaShowStore wait at 25s instead of 60s ([c0aa2f8](https://github.com/BambooFury/Auto-Claim/commit/c0aa2f81b16b1839a12806c23f9cb01807a74a05))
* **frontend:** reduce ShowStore attempts and use exponential backoff ([3271526](https://github.com/BambooFury/Auto-Claim/commit/327152672f9889070d7a3d56ca3ea4e04a633513))
* **webkit:** cache cookie payload in localStorage to dedupe across tabs ([954bdcb](https://github.com/BambooFury/Auto-Claim/commit/954bdcb44d713dab9360387c9ed1548cf8d6bf52))
* **widget:** skip cache poll while panel is closed ([6800ea5](https://github.com/BambooFury/Auto-Claim/commit/6800ea5f8ab185585fabca907adcc7ecf2a275f0))


### Refactoring

* **frontend:** extract MIN_POLL_INTERVAL_MIN and option list to constants module ([b5a4c05](https://github.com/BambooFury/Auto-Claim/commit/b5a4c059e1553fcd9580eb5c001c4757913d4529))


### Documentation

* update example screenshot ([c78dddb](https://github.com/BambooFury/Auto-Claim/commit/c78dddbafaee13eb33ffd5f5c63e3f499b3c69f6))

## [1.3.4](https://github.com/BambooFury/Auto-Claim/compare/v1.3.3...v1.3.4) (2026-05-04)


### Bug Fixes

* **backend:** resolve PLUGIN_DIR with forward-slash source paths ([36ed55a](https://github.com/BambooFury/Auto-Claim/commit/36ed55a11dc210b11ee201bd7f7276ad6bde9ee0))

## [1.3.3](https://github.com/BambooFury/Auto-Claim/compare/v1.3.2...v1.3.3) (2026-05-04)


### Bug Fixes

* **widget:** remove Minimal Dark theme support ([a49b413](https://github.com/BambooFury/Auto-Claim/commit/a49b4136d733693816945dce9367e1aaa0951d71))

## [1.3.2](https://github.com/BambooFury/Auto-Claim/compare/v1.3.1...v1.3.2) (2026-05-04)


### Bug Fixes

* **backend:** cap IPC payload size to prevent runaway writes ([2d7e4ac](https://github.com/BambooFury/Auto-Claim/commit/2d7e4ac8efce6a3f993217ff8827f614a98eb476))
* **backend:** combine UTF-16 surrogate pairs in pure-Lua JSON decoder ([11052b0](https://github.com/BambooFury/Auto-Claim/commit/11052b017b8504da35eadc6cd71a56546b784dff))
* **backend:** escape control characters in cache JSON output ([f48fdfe](https://github.com/BambooFury/Auto-Claim/commit/f48fdfe60f9dba2ec49e68e7d916e439bb3e3736))
* **backend:** prevent pop_toasts_ipc from dropping concurrent pushes ([ffb6b5d](https://github.com/BambooFury/Auto-Claim/commit/ffb6b5d2f9a0b5dbc848b0ece45c41e8988a8d30))
* **backend:** recover orphaned toast stash on next pop after crash ([6a919a9](https://github.com/BambooFury/Auto-Claim/commit/6a919a9099c897a863c7d7f0f18d79bded8860ed))
* **backend:** rewrite write_file to avoid wiping originals on Windows ([54807b4](https://github.com/BambooFury/Auto-Claim/commit/54807b47cb481d3082e8fc805b8fb1f10e2630fc))
* **backend:** rewrite write_file to avoid wiping originals on Windows ([7eb9e7f](https://github.com/BambooFury/Auto-Claim/commit/7eb9e7f4db38c8e03b958973ed607932264895bd))
* **backend:** tighten subid regex to avoid grabbing paid packages ([ce47330](https://github.com/BambooFury/Auto-Claim/commit/ce47330e1b77263130715e63550855a9ecd2a21e))
* **backend:** URL-encode storesearch terms instead of partial substitution ([171e326](https://github.com/BambooFury/Auto-Claim/commit/171e32630ed5baf5324d28387a57ccd23f8533a4))
* **backend:** validate cookies JSON before overwriting stored value ([288f167](https://github.com/BambooFury/Auto-Claim/commit/288f1670ef663e183028dab323a89175ab44a65c))
* **backend:** verify GamerPower-sourced appids are free games before claim ([32f164d](https://github.com/BambooFury/Auto-Claim/commit/32f164d4ebf9c14ea9be158275d2be4353c63192))
* **claim:** drop generic packageid fallback that could grab paid sub ([57a96cc](https://github.com/BambooFury/Auto-Claim/commit/57a96cc945227ebbfe502481208664417143d837))
* **frontend:** clamp pollIntervalMin to match webkit minimum ([fae428e](https://github.com/BambooFury/Auto-Claim/commit/fae428efd14e7294ea8d51922eaf0c5c7f27643b))
* **frontend:** clean up HsvPicker drag listeners on unmount ([27e8c78](https://github.com/BambooFury/Auto-Claim/commit/27e8c78862cdb57d8054d1837cbe507b7b8ea008))
* **frontend:** compare scan sequence numerically and ignore backend resets ([41d0e7d](https://github.com/BambooFury/Auto-Claim/commit/41d0e7d8d1607fa9d5bedbad9e0b61cc5c2e9823))
* **frontend:** refresh settings between scans for pollIntervalMin updates ([d836352](https://github.com/BambooFury/Auto-Claim/commit/d836352040ea1a9389375725a10eeb6b7bf94b4a))
* **frontend:** throttle repetitive 'skipping' log lines per appid ([4c54c77](https://github.com/BambooFury/Auto-Claim/commit/4c54c771bbbec937e2a16b69691c5080748c70a1))
* **frontend:** use word-boundary regexes in scan name blocklist ([fc37944](https://github.com/BambooFury/Auto-Claim/commit/fc37944a5795b273a0ccdf8c5fa15d04dda7830b))
* **frontend:** wire ring active state for custom color button ([5740b7e](https://github.com/BambooFury/Auto-Claim/commit/5740b7e5fdd1186e8a3170b2d9f9f39031be241a))
* **welcome-modal:** remove keydown listener on every close path ([1b04f08](https://github.com/BambooFury/Auto-Claim/commit/1b04f08fa09c3fff706648eed3896679be1bbaf5))
* **widget:** escape game name in card to prevent HTML injection ([0ef03f1](https://github.com/BambooFury/Auto-Claim/commit/0ef03f16d84849bbdd0dfc97f6724a6fe359b4e7))
* **widget:** escape names in manual scan result list ([82a4a7a](https://github.com/BambooFury/Auto-Claim/commit/82a4a7a249ab7d3d7f832bd8dff8cb27ff632b83))
* **widget:** guard softRefresh against re-entrant overlapping calls ([cc87780](https://github.com/BambooFury/Auto-Claim/commit/cc87780c677411bf387187040f683c339fc0d3c6))
* **widget:** show overflow indicator when more than 8 games are queued ([5782076](https://github.com/BambooFury/Auto-Claim/commit/578207646b59336c7f8ce99c14a3ea45a1a41c01))
* **widget:** use JSON.stringify for toast payload to escape all chars ([ba2e025](https://github.com/BambooFury/Auto-Claim/commit/ba2e02598e1c1916643e206cd0360c5868d80a3d))


### Performance

* **backend:** cap GamerPower entries processed per scan to 20 ([ac02d20](https://github.com/BambooFury/Auto-Claim/commit/ac02d20a5786f1d02da1be9b8468bd5840208224))
* **cookies:** skip cookie write when payload matches last sent value ([e4718b1](https://github.com/BambooFury/Auto-Claim/commit/e4718b16d4e0c0ad0f5803eccb082111292c35e8))
* **widget:** cache isMinimalDark result for the duration of render ([ce3df87](https://github.com/BambooFury/Auto-Claim/commit/ce3df8785a89c43c787e78b2d6f9d853a35ba3e3))
* **widget:** skip widget settings poll while panel is closed ([055ab13](https://github.com/BambooFury/Auto-Claim/commit/055ab139bd4045cba20236f196d9c5934162e702))


### Refactoring

* **widget:** replace inline onerror with addEventListener fallback ([078d93d](https://github.com/BambooFury/Auto-Claim/commit/078d93d8fcc359b57f143d9c432cffa853f381fb))


### Maintenance

* **settings:** strip legacy notifyOnly key when persisting settings ([6e639cf](https://github.com/BambooFury/Auto-Claim/commit/6e639cfacb83c117715d67d2493b4f133242194f))

## [1.3.1](https://github.com/BambooFury/Auto-Claim/compare/v1.3.0...v1.3.1) (2026-05-04)


### Bug Fixes

* correct toggle button shape and knob size for Minimal Dark theme ([e86a5de](https://github.com/BambooFury/Auto-Claim/commit/e86a5de42348d6a3cab80884f343870cd6ccabfa))

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
