# Changelog

## [1.5.7](https://github.com/BambooFury/Auto-Claim/compare/v1.5.6...v1.5.7) (2026-05-27)


### Bug Fixes

* poll scan now requests faster ([5ab417c](https://github.com/BambooFury/Auto-Claim/commit/5ab417c6115b11cddd85432ef5f1c7532125c76e))
* remove legacy scan ipc ([a7645d3](https://github.com/BambooFury/Auto-Claim/commit/a7645d3bafd22283ecc77f3d7fd78f952b1e8188))
* stabilize scan flow ([2d894dd](https://github.com/BambooFury/Auto-Claim/commit/2d894dd20bd11db8e63f2e62f61c4bf92a9e63e5))
* stabilize scan flow ([53cf1ec](https://github.com/BambooFury/Auto-Claim/commit/53cf1ec73415a8e2a226579b57a60bbb1d655cd4))
* wait for scan now results ([4ff3d1b](https://github.com/BambooFury/Auto-Claim/commit/4ff3d1b8554ee754c6aa0f81b727855d895b13d0))

## [1.5.6](https://github.com/BambooFury/Auto-Claim/compare/v1.5.5...v1.5.6) (2026-05-26)


### Bug Fixes

* update moduleResolution to bundler for TypeScript 7.0 compatibility ([e48be1b](https://github.com/BambooFury/Auto-Claim/commit/e48be1b454902ffd3cd8551ce499c5fcc8f5c65c))
* update moduleResolution to bundler for TypeScript 7.0 compatibility ([3d76f3e](https://github.com/BambooFury/Auto-Claim/commit/3d76f3e16796eab49213d2385e36ee157c794b54))

## [1.5.5](https://github.com/BambooFury/Auto-Claim/compare/v1.5.4...v1.5.5) (2026-05-26)


### Bug Fixes

* Fixing plugin crashes ([4b1d9ab](https://github.com/BambooFury/Auto-Claim/commit/4b1d9aba6e64b7a2007dfe77a0b59cbbda2ba0fa))
* Fixing plugin crashes ([c624714](https://github.com/BambooFury/Auto-Claim/commit/c62471482ff8f1afccc9ed94ef7fe003e2f36b67))

## [1.5.4](https://github.com/BambooFury/Auto-Claim/compare/v1.5.3...v1.5.4) (2026-05-18)


### Bug Fixes

* silence gamerpower empty-body warning, add curl retries ([3f68b73](https://github.com/BambooFury/Auto-Claim/commit/3f68b733c34161a4c5472be8c9e6f86b38b0409b))
* silence gamerpower empty-body warning, add curl retries ([629ab50](https://github.com/BambooFury/Auto-Claim/commit/629ab5091bf01d463a8680a4be2682ee1ed0fa9a))

## [1.5.3](https://github.com/BambooFury/Auto-Claim/compare/v1.5.2...v1.5.3) (2026-05-17)


### Bug Fixes

* bypass Millennium luavm64 crash via curl over LuaJIT FFI ([ee49992](https://github.com/BambooFury/Auto-Claim/commit/ee4999280bcc80c1da4f835ed09604b4f639ed5c))


### Maintenance

* **gitignore:** ignore accounts/ folder ([7333cc4](https://github.com/BambooFury/Auto-Claim/commit/7333cc4c60b4256970b1bd1fd863bf1cd42f4632))

## [1.5.2](https://github.com/BambooFury/Auto-Claim/compare/v1.5.1...v1.5.2) (2026-05-13)


### Bug Fixes

* **scanner:** add TypeScript scanner modules (search/gamerpower/appdetails) ([f6644b2](https://github.com/BambooFury/Auto-Claim/commit/f6644b274fce278ef6454814dc29bf611d3c656a))
* **scanner:** always bump scan_done_seq even on fallback/timeout ([602f474](https://github.com/BambooFury/Auto-Claim/commit/602f474adb1454b06afdf0ebd7b89a7876a7c98f))
* **scanner:** move HTTP scan from Lua to TypeScript fetch ([73c26d2](https://github.com/BambooFury/Auto-Claim/commit/73c26d273a9b2e1dd4daf35624f0881ebea98b12))
* **scanner:** proxy GamerPower fetch through Lua to bypass CORS ([975880f](https://github.com/BambooFury/Auto-Claim/commit/975880faad3f419f3c64eb9895b9b97f7bebf3c8))
* **scanner:** proxy storesearch through Lua to bypass CORS ([c282c6e](https://github.com/BambooFury/Auto-Claim/commit/c282c6e240fdd8f084840d54e2d30c075614363e))


### Maintenance

* ignore local V2_PLAN.md from version control ([644ba09](https://github.com/BambooFury/Auto-Claim/commit/644ba09f29831c611e5c69bbdc77ec51819a3896))
* **scanner:** add diagnostic logs to appdetails verification ([681348e](https://github.com/BambooFury/Auto-Claim/commit/681348e15ca061132b1658bc420022a325105d2d))
* **scanner:** remove duplicate [AutoClaim] log prefix ([7170783](https://github.com/BambooFury/Auto-Claim/commit/7170783a8bca8e1627011eeec3f04929d4a03c21))

## [1.5.1](https://github.com/BambooFury/Auto-Claim/compare/v1.5.0...v1.5.1) (2026-05-12)


### Bug Fixes

* **backend:** cap HTTP response body at 4MB to avoid huge allocs ([eeca1ba](https://github.com/BambooFury/Auto-Claim/commit/eeca1ba1da73d5b65c39323e7030e0bbc2d5c087))
* **backend:** guard fetch_free_games_backend against re-entrant calls ([1cdd4d4](https://github.com/BambooFury/Auto-Claim/commit/1cdd4d489e22f13736f1ec0e3df03af6a7057a66))
* **backend:** guard fetch_free_games_backend against re-entrant calls ([4a11ee5](https://github.com/BambooFury/Auto-Claim/commit/4a11ee548b246b1ab0e02e77e618853c21507498))


### Maintenance

* ignore parse_dump.py dev tool and .dmp files ([ce121e0](https://github.com/BambooFury/Auto-Claim/commit/ce121e0dd6e37ff9d6063f2ff43e363cbbd6bb45))

## [1.5.0](https://github.com/BambooFury/Auto-Claim/compare/v1.4.3...v1.5.0) (2026-05-11)


### Features

* dedupe notifications for already-notified free games ([17cce8e](https://github.com/BambooFury/Auto-Claim/commit/17cce8e5e14ce89fef12d78f81ad56027fdea108))
* default auto-add to OFF (opt-in) ([be473e9](https://github.com/BambooFury/Auto-Claim/commit/be473e9b1e256b8a8997321cf99922d96b91e2f6))
* disable auto-claim when filter='all' (manual-only mode) ([ed2f875](https://github.com/BambooFury/Auto-Claim/commit/ed2f8751d18e5eba94f986f57cd8638504cf81a1))
* invisible game claiming via hidden BrowserView ([08413c1](https://github.com/BambooFury/Auto-Claim/commit/08413c167a783bbce931ec8e0265f908305b78d6))
* **welcome:** bump to v4 and describe fully invisible claiming ([feaf536](https://github.com/BambooFury/Auto-Claim/commit/feaf536398603323d8c46ddf05bc45b2099c4672))
* **widget:** clear new-game indicator after opening panel ([2399b5a](https://github.com/BambooFury/Auto-Claim/commit/2399b5aff9d05baff813aa6155267ed7f2707022))


### Bug Fixes

* **backend:** remove orphan save_cookies_ipc stub causing Lua parse crash ([c56ff05](https://github.com/BambooFury/Auto-Claim/commit/c56ff051916a61597c36b436c9854f2999db7107))
* **backend:** warn level + max bytes in oversized payload log ([690d497](https://github.com/BambooFury/Auto-Claim/commit/690d497d7b67a4c3cebeb97a8ba0a211854ad45e))
* **claim:** set Referer header in XHR fallback for parity with fetch ([7cf1b08](https://github.com/BambooFury/Auto-Claim/commit/7cf1b0870f3ef2d00b7031ddcac7763468a8be0e))
* **library:** tighten ownership check, remove fallthrough for undefined is_owned ([a47c50b](https://github.com/BambooFury/Auto-Claim/commit/a47c50b9a4de882b3383d3a24425b7996468982e))
* load real Steam CDN image URLs for widget cards ([937ae16](https://github.com/BambooFury/Auto-Claim/commit/937ae1640d0cc98c36949610cbce523c64c4ea2d))
* **security:** remove unused steam_cookies.json capture ([7b65bc9](https://github.com/BambooFury/Auto-Claim/commit/7b65bc9ca38bcb2b1aa7ba1dcd78e0370b1514fe))
* **widget:** respect filter='all' in runAutoClaim and softRefresh ([e831449](https://github.com/BambooFury/Auto-Claim/commit/e831449fd13998908ef9115a65ccfb50e3afe7be))
* **widget:** scope seen-appids set per Steam account ([579f05e](https://github.com/BambooFury/Auto-Claim/commit/579f05e6f827f028b0adfe9303c4f798899ecfdc))


### Performance

* cache widget filterMode once per scan instead of per game ([98d1fdd](https://github.com/BambooFury/Auto-Claim/commit/98d1fddda1beea6d3522eb37266f78fe382acb55))


### Refactoring

* inline _addGameToLibraryLocked (vestigial single-path wrapper) ([5422f2f](https://github.com/BambooFury/Auto-Claim/commit/5422f2fdd702f61f9a7af046d86f52d819837230))


### Documentation

* describe always-invisible claiming in README ([1cb766c](https://github.com/BambooFury/Auto-Claim/commit/1cb766ca3a341fd67a49510432e5b35c59c93461))
* **README:** note auto-add is off by default ([f294d8c](https://github.com/BambooFury/Auto-Claim/commit/f294d8c4392ad19cc48e2ac1d932c7b9acdb8022))
* **welcome:** bump to v5, clarify Games vs All filter modes ([37f8c8d](https://github.com/BambooFury/Auto-Claim/commit/37f8c8d146aff3ac4a9d5f0c537273350b0fe733))

## [1.4.3](https://github.com/BambooFury/Auto-Claim/compare/v1.4.2...v1.4.3) (2026-05-09)


### Bug Fixes

* filter toggle feedback toast ([5433d56](https://github.com/BambooFury/Auto-Claim/commit/5433d5691a1a102179b759779c4c358d73e4c067))
* locale-independent claim button detection ([3b3d766](https://github.com/BambooFury/Auto-Claim/commit/3b3d766e8e485cb7141db9b3ec4f76b2651ee93b))


### Refactoring

* extract panel CSS and HTML templates into asset files ([2c98230](https://github.com/BambooFury/Auto-Claim/commit/2c98230f8b506b8399271dd1b2427f8378f36561))
* extract SVG icons into separate .svg files ([791fa6b](https://github.com/BambooFury/Auto-Claim/commit/791fa6bb72ad9d9d961daa9dac9c1dd9677baa23))
* extract welcome modal SVG icons, CSS and HTML into separate files ([e5688ed](https://github.com/BambooFury/Auto-Claim/commit/e5688edd5c4437bb451c75a5390586a8a5d3422c))

## [1.4.2](https://github.com/BambooFury/Auto-Claim/compare/v1.4.1...v1.4.2) (2026-05-07)


### Bug Fixes

* ignore claim_jobs.json ([f5ff83b](https://github.com/BambooFury/Auto-Claim/commit/f5ff83ba4249580d22c250f657e37753175730fa))
* silent claim queue via webkit, real-time indicator and badge updates ([53d3a35](https://github.com/BambooFury/Auto-Claim/commit/53d3a35f224724dbe874d722e56da65ed97b725e))

## [1.4.1](https://github.com/BambooFury/Auto-Claim/compare/v1.4.0...v1.4.1) (2026-05-06)


### Bug Fixes

* apply settings changes in real-time, update badge on hide-owned toggle ([f8f939b](https://github.com/BambooFury/Auto-Claim/commit/f8f939b4de81df8680c3930ae350fe1d50945bd1))
* disable filter button keyboard access on settings tab ([67719e7](https://github.com/BambooFury/Auto-Claim/commit/67719e75d5fed1b22da52cad018118340f5c601f))
* replace filter dropdown with toggle, dim filter btn on settings tab ([067f082](https://github.com/BambooFury/Auto-Claim/commit/067f082c93dfd76910901b2a8c0ca37533298151))
* replace filter dropdown with toggle, dim filter btn on settings tab ([3d5c2d3](https://github.com/BambooFury/Auto-Claim/commit/3d5c2d347cdc4ee3de583c269d90c4d9b1db5118))

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
