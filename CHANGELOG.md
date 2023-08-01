# Changelog

## [0.5.10](https://github.com/anthropics/anthropic-sdk-typescript/compare/v0.5.9...v0.5.10) (2023-08-01)


### Refactors

* create build for deno.land ([#93](https://github.com/anthropics/anthropic-sdk-typescript/issues/93)) ([2ea741a](https://github.com/anthropics/anthropic-sdk-typescript/commit/2ea741a4d4a3123b2eaafb87b73d7884c69ae23b))


### Documentation

* **readme:** add token counting reference ([#94](https://github.com/anthropics/anthropic-sdk-typescript/issues/94)) ([2c6a699](https://github.com/anthropics/anthropic-sdk-typescript/commit/2c6a699d499a3468fc4312a6b6c9493ffd1806a2))


### Chores

* **internal:** allow the build script to be run without yarn installed ([#91](https://github.com/anthropics/anthropic-sdk-typescript/issues/91)) ([9bd2b28](https://github.com/anthropics/anthropic-sdk-typescript/commit/9bd2b2871ca8a3b5f2466a904153d5c234094372))
* **internal:** fix deno build ([#96](https://github.com/anthropics/anthropic-sdk-typescript/issues/96)) ([3fdab4e](https://github.com/anthropics/anthropic-sdk-typescript/commit/3fdab4e33b4c8668d17b8cddabbb09a22adf4124))

## [0.5.9](https://github.com/anthropics/anthropic-sdk-typescript/compare/v0.5.8...v0.5.9) (2023-07-29)


### Bug Fixes

* **client:** handle undefined process in more places ([#87](https://github.com/anthropics/anthropic-sdk-typescript/issues/87)) ([d950c25](https://github.com/anthropics/anthropic-sdk-typescript/commit/d950c25469a6c6b0dd3cfecd282db078826366ba))
* **examples:** avoid swallowing errors in example scripts ([#82](https://github.com/anthropics/anthropic-sdk-typescript/issues/82)) ([b27cfe9](https://github.com/anthropics/anthropic-sdk-typescript/commit/b27cfe9323bce983bb49f57dece98f1d9e507034))
* fix undefined message in errors ([#86](https://github.com/anthropics/anthropic-sdk-typescript/issues/86)) ([5714a14](https://github.com/anthropics/anthropic-sdk-typescript/commit/5714a14d9af282a3d308b8694e6e03309d4b5642))


### Chores

* **internal:** minor refactoring of client instantiation ([#88](https://github.com/anthropics/anthropic-sdk-typescript/issues/88)) ([2c53e1c](https://github.com/anthropics/anthropic-sdk-typescript/commit/2c53e1ca28a444a48e5f1041d9eb9077608b3fc7))


### Refactors

* use destructuring arguments in client constructor and respect false values ([#89](https://github.com/anthropics/anthropic-sdk-typescript/issues/89)) ([8d4c686](https://github.com/anthropics/anthropic-sdk-typescript/commit/8d4c6860273bbd16027023700d521a5e48db76f7))

## [0.5.8](https://github.com/anthropics/anthropic-sdk-typescript/compare/v0.5.7...v0.5.8) (2023-07-22)


### Features

* **streaming:** make requests immediately throw an error if an aborted signal is passed in ([#79](https://github.com/anthropics/anthropic-sdk-typescript/issues/79)) ([5c86597](https://github.com/anthropics/anthropic-sdk-typescript/commit/5c865979a21d18db87df43a9bdb27b701815f4bb))

## [0.5.7](https://github.com/anthropics/anthropic-sdk-typescript/compare/v0.5.6...v0.5.7) (2023-07-19)


### Features

* add flexible enum to model param ([#73](https://github.com/anthropics/anthropic-sdk-typescript/issues/73)) ([a6bbcad](https://github.com/anthropics/anthropic-sdk-typescript/commit/a6bbcadb447060f3c2e60881d31d7b7fb7a50512))
* **client:** export ClientOptions interface ([#75](https://github.com/anthropics/anthropic-sdk-typescript/issues/75)) ([0315ce1](https://github.com/anthropics/anthropic-sdk-typescript/commit/0315ce170db463ad900384ab7e4f62885cb471a2))
* **deps:** remove unneeded qs dep ([#72](https://github.com/anthropics/anthropic-sdk-typescript/issues/72)) ([0aea5a6](https://github.com/anthropics/anthropic-sdk-typescript/commit/0aea5a6f4852f351ecbe9f46d6857a6fafc7e864))


### Bug Fixes

* **client:** fix errors with file uploads in the browser ([#76](https://github.com/anthropics/anthropic-sdk-typescript/issues/76)) ([ac48fa7](https://github.com/anthropics/anthropic-sdk-typescript/commit/ac48fa72bb764b2abed95f200bc658f65725e2b3))
* fix error in environments without `TextEncoder` ([#70](https://github.com/anthropics/anthropic-sdk-typescript/issues/70)) ([5b78e05](https://github.com/anthropics/anthropic-sdk-typescript/commit/5b78e0586fd351258ccc05c8ba89a2ba66681b0d))
* fix export map order ([#74](https://github.com/anthropics/anthropic-sdk-typescript/issues/74)) ([51e70cb](https://github.com/anthropics/anthropic-sdk-typescript/commit/51e70cb9b55128d4de1b0597fad475d0f4bc836c))

## [0.5.6](https://github.com/anthropics/anthropic-sdk-typescript/compare/v0.5.5...v0.5.6) (2023-07-15)


### Bug Fixes

* fix errors with "named" client export in CJS ([#67](https://github.com/anthropics/anthropic-sdk-typescript/issues/67)) ([08ef69c](https://github.com/anthropics/anthropic-sdk-typescript/commit/08ef69cca87bbdf82440d163611f45e04e894234))

## [0.5.5](https://github.com/anthropics/anthropic-sdk-typescript/compare/v0.5.4...v0.5.5) (2023-07-13)


### Features

* **client:** add support for passing a `signal` request option ([#55](https://github.com/anthropics/anthropic-sdk-typescript/issues/55)) ([09604e9](https://github.com/anthropics/anthropic-sdk-typescript/commit/09604e9990e13dd703f4bcfd0a241b8ec2ebbc71))


### Bug Fixes

* **streaming:** do not abort successfully completed streams ([#53](https://github.com/anthropics/anthropic-sdk-typescript/issues/53)) ([950dd49](https://github.com/anthropics/anthropic-sdk-typescript/commit/950dd4930429010d89ae31eef9ebb193be9517ad))


### Documentation

* **examples:** bump model to claude-2 in example scripts ([#57](https://github.com/anthropics/anthropic-sdk-typescript/issues/57)) ([f85c05d](https://github.com/anthropics/anthropic-sdk-typescript/commit/f85c05d49a7a9db1deb8eed9124934da763b721b))
* **readme:** improvements to formatting code snippets ([#58](https://github.com/anthropics/anthropic-sdk-typescript/issues/58)) ([67bae64](https://github.com/anthropics/anthropic-sdk-typescript/commit/67bae64d5388e7e71ea3a891b3579c072b743f38))


### Chores

* **internal:** add helper function for b64 ([#62](https://github.com/anthropics/anthropic-sdk-typescript/issues/62)) ([04e303c](https://github.com/anthropics/anthropic-sdk-typescript/commit/04e303c5cc7b14a862b81379d547b3dc6e908720))
* **internal:** let `toFile` helper accept promises to objects with name/type properties ([#63](https://github.com/anthropics/anthropic-sdk-typescript/issues/63)) ([93f9af2](https://github.com/anthropics/anthropic-sdk-typescript/commit/93f9af29a91cfced533d309d1816c58bc2efa355))
* **internal:** remove unneeded type var usage ([#59](https://github.com/anthropics/anthropic-sdk-typescript/issues/59)) ([42fc4a9](https://github.com/anthropics/anthropic-sdk-typescript/commit/42fc4a90cc267f077b26d2bafebe487a74cae067))

## [0.5.4](https://github.com/anthropics/anthropic-sdk-typescript/compare/v0.5.3...v0.5.4) (2023-07-11)


### Features

* **api:** reference claude-2 in examples ([#50](https://github.com/anthropics/anthropic-sdk-typescript/issues/50)) ([7c53ded](https://github.com/anthropics/anthropic-sdk-typescript/commit/7c53ded6b7f5f3efec0df295181f18469c37e09d))
* **client:** support passing a custom `fetch` function ([#46](https://github.com/anthropics/anthropic-sdk-typescript/issues/46)) ([7d54366](https://github.com/anthropics/anthropic-sdk-typescript/commit/7d54366fcefa0267e831a0cca4d10c9a146d9f6c))


### Bug Fixes

* **client:** properly handle multi-byte characters in Content-Length ([#47](https://github.com/anthropics/anthropic-sdk-typescript/issues/47)) ([8dfff26](https://github.com/anthropics/anthropic-sdk-typescript/commit/8dfff2691a3ebd5721462c055d8da638ac77e571))


### Refactors

* **streaming:** make response body streaming polyfill more spec-compliant ([#44](https://github.com/anthropics/anthropic-sdk-typescript/issues/44)) ([047d328](https://github.com/anthropics/anthropic-sdk-typescript/commit/047d328cb0968fb1926e41326d35b595ba3fb3bc))
