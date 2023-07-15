# Changelog

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
