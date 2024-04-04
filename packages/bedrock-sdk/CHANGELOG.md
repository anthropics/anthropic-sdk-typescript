# Changelog

## 0.9.4 (2024-04-04)

Full Changelog: [bedrock-sdk-v0.9.3...bedrock-sdk-v0.9.4](https://github.com/anthropics/anthropic-sdk-typescript/compare/bedrock-sdk-v0.9.3...bedrock-sdk-v0.9.4)

### Bug Fixes

* **types:** correctly mark type as a required property in requests ([#371](https://github.com/anthropics/anthropic-sdk-typescript/issues/371)) ([a04edd8](https://github.com/anthropics/anthropic-sdk-typescript/commit/a04edd8d7f4c552281b37a44099edf432d7fcb27))

## 0.9.3 (2024-04-04)

Full Changelog: [bedrock-sdk-v0.9.2...bedrock-sdk-v0.9.3](https://github.com/anthropics/anthropic-sdk-typescript/compare/bedrock-sdk-v0.9.2...bedrock-sdk-v0.9.3)

### Chores

* **deps:** remove unused dependency digest-fetch ([#368](https://github.com/anthropics/anthropic-sdk-typescript/issues/368)) ([df1df0f](https://github.com/anthropics/anthropic-sdk-typescript/commit/df1df0f509682841c703fa1ea5062a796cfe2091))

## 0.9.2 (2024-03-29)

Full Changelog: [bedrock-sdk-v0.9.1...bedrock-sdk-v0.9.2](https://github.com/anthropics/anthropic-sdk-typescript/compare/bedrock-sdk-v0.9.1...bedrock-sdk-v0.9.2)

### Documentation

* **bedrock:** fix dead link ([#356](https://github.com/anthropics/anthropic-sdk-typescript/issues/356)) ([a953e00](https://github.com/anthropics/anthropic-sdk-typescript/commit/a953e0070698f3238b728ffe06a056a9f2d6b7ff))

## 0.9.1 (2024-03-06)

Full Changelog: [bedrock-sdk-v0.9.0...bedrock-sdk-v0.9.1](https://github.com/anthropics/anthropic-sdk-typescript/compare/bedrock-sdk-v0.9.0...bedrock-sdk-v0.9.1)

### Documentation

* remove extraneous --save and yarn install instructions ([#323](https://github.com/anthropics/anthropic-sdk-typescript/issues/323)) ([775ecb9](https://github.com/anthropics/anthropic-sdk-typescript/commit/775ecb9ef3ab17e88dabc149faa0876cd6ab5f0b))

## 0.9.0 (2024-03-04)

Full Changelog: [bedrock-sdk-v0.8.0...bedrock-sdk-v0.9.0](https://github.com/anthropics/anthropic-sdk-typescript/compare/bedrock-sdk-v0.8.0...bedrock-sdk-v0.9.0)

### Features

* **bedrock:** add messages API ([#305](https://github.com/anthropics/anthropic-sdk-typescript/issues/305)) ([8b7f89e](https://github.com/anthropics/anthropic-sdk-typescript/commit/8b7f89e1e60416f9ad5b575d43238a4259654395))

## 0.8.0 (2024-03-04)

Full Changelog: [bedrock-sdk-v0.7.1...bedrock-sdk-v0.8.0](https://github.com/anthropics/anthropic-sdk-typescript/compare/bedrock-sdk-v0.7.1...bedrock-sdk-v0.8.0)

### Features

* **messages:** add support for image inputs ([#303](https://github.com/anthropics/anthropic-sdk-typescript/issues/303)) ([7663bd6](https://github.com/anthropics/anthropic-sdk-typescript/commit/7663bd6e1a4427483cf5f13889bc5c63314e5bae))

## 0.7.1 (2024-01-31)

Full Changelog: [bedrock-sdk-v0.7.0...bedrock-sdk-v0.7.1](https://github.com/anthropics/anthropic-sdk-typescript/compare/bedrock-sdk-v0.7.0...bedrock-sdk-v0.7.1)

### Chores

* **bedrock:** move bedrock SDK to the main repo ([#274](https://github.com/anthropics/anthropic-sdk-typescript/issues/274)) ([1a565fe](https://github.com/anthropics/anthropic-sdk-typescript/commit/1a565feddd19c3dbe62f087fc9f13520bb69fc0e))
* release main ([6679340](https://github.com/anthropics/anthropic-sdk-typescript/commit/6679340c68b7f1599e5a9a543371f7426f96307a))

## 0.7.0 (2024-01-31)

This release restructures the SDK so that it relies on the main `@anthropic-ai/sdk` instead of duplicating everything.

- All subpath imports are broken, e.g. `import { Completion } from '@anthropic-ai/bedrock-sdk/resources/completions'`
- Types are no longer exported through the default import, e.g. `AnthropicBedrock.Completion`
  - e.g. AnthropicBedrock.APIError, AnthropicBedrock.HUMAN_PROMPT

However, these are all an straightforward fixes, you just have to replace `@anthropic-ai/bedrock-sdk` with `@anthropic-ai/sdk`, e.g.

```diff
- import AnthropicBedrock from '@anthropic-ai/bedrock-sdk';
+ import Anthropic from '@anthropic-ai/sdk';

- type Completion = AnthropicBedrock.Completion;
+ type Completion = Anthropic.Completion;
```

## 0.6.5 (2024-01-30)

Full Changelog: [v0.6.4...v0.6.5](https://github.com/anthropics/anthropic-bedrock-typescript/compare/v0.6.4...v0.6.5)

### Chores

* **internal:** support pre-release versioning ([#77](https://github.com/anthropics/anthropic-bedrock-typescript/issues/77)) ([b96f745](https://github.com/anthropics/anthropic-bedrock-typescript/commit/b96f745cf406677a552c863b2c5ee967f3353919))

## 0.6.4 (2024-01-25)

Full Changelog: [v0.6.3...v0.6.4](https://github.com/anthropics/anthropic-bedrock-typescript/compare/v0.6.3...v0.6.4)

### Chores

* **internal:** add internal helpers & improve build scripts ([#73](https://github.com/anthropics/anthropic-bedrock-typescript/issues/73)) ([d12b655](https://github.com/anthropics/anthropic-bedrock-typescript/commit/d12b655286e3677e4a24a5616bb633b553fa5784))
* **internal:** don't re-export streaming type ([#76](https://github.com/anthropics/anthropic-bedrock-typescript/issues/76)) ([92fb967](https://github.com/anthropics/anthropic-bedrock-typescript/commit/92fb967c40d8c730441fc3b42bef92bc478436aa))
* **internal:** minor streaming updates ([#75](https://github.com/anthropics/anthropic-bedrock-typescript/issues/75)) ([73bac4c](https://github.com/anthropics/anthropic-bedrock-typescript/commit/73bac4c4f2f6edc4b7a72274cd3146c5821b53a8))

## 0.6.3 (2024-01-19)

Full Changelog: [v0.6.2...v0.6.3](https://github.com/anthropics/anthropic-bedrock-typescript/compare/v0.6.2...v0.6.3)

### Bug Fixes

* allow body type in RequestOptions to be null ([#71](https://github.com/anthropics/anthropic-bedrock-typescript/issues/71)) ([a04f753](https://github.com/anthropics/anthropic-bedrock-typescript/commit/a04f7538e789324cebcea61476c1d745bbfc30cf))

## 0.6.2 (2024-01-18)

Full Changelog: [v0.6.1...v0.6.2](https://github.com/anthropics/anthropic-bedrock-typescript/compare/v0.6.1...v0.6.2)

### Bug Fixes

* **ci:** ignore stainless-app edits to release PR title ([#70](https://github.com/anthropics/anthropic-bedrock-typescript/issues/70)) ([c3a058c](https://github.com/anthropics/anthropic-bedrock-typescript/commit/c3a058cccfdc0f0db1fbf06c57c13374bad58015))
* **headers:** always send lowercase headers and strip undefined (BREAKING in rare cases) ([#60](https://github.com/anthropics/anthropic-bedrock-typescript/issues/60)) ([9cc4518](https://github.com/anthropics/anthropic-bedrock-typescript/commit/9cc4518ebd41d6ee438e686f4d0da2629e511796))
* **types:** accept undefined for optional client options ([#69](https://github.com/anthropics/anthropic-bedrock-typescript/issues/69)) ([cf597f6](https://github.com/anthropics/anthropic-bedrock-typescript/commit/cf597f6384337109011cd7d920b6a6530cdef74f))
* use default base url if BASE_URL env var is blank ([#64](https://github.com/anthropics/anthropic-bedrock-typescript/issues/64)) ([134bf8f](https://github.com/anthropics/anthropic-bedrock-typescript/commit/134bf8f35d6071224280c9bed6151e107fee3c93))


### Chores

* add .keep files for examples and custom code directories ([#63](https://github.com/anthropics/anthropic-bedrock-typescript/issues/63)) ([0064f30](https://github.com/anthropics/anthropic-bedrock-typescript/commit/0064f3035cf4a11645c632abf1e026ee27ac92a2))
* **internal:** debug logging for retries; speculative retry-after-ms support ([#68](https://github.com/anthropics/anthropic-bedrock-typescript/issues/68)) ([e6a95f6](https://github.com/anthropics/anthropic-bedrock-typescript/commit/e6a95f644a300c5e3d5856edcaf98c60c953e461))
* **internal:** improve type signatures ([#62](https://github.com/anthropics/anthropic-bedrock-typescript/issues/62)) ([6e24bdc](https://github.com/anthropics/anthropic-bedrock-typescript/commit/6e24bdc7ee82252243c0f83c68c5b6a363d756fc))
* **internal:** narrow type into stringifyQuery ([#65](https://github.com/anthropics/anthropic-bedrock-typescript/issues/65)) ([443febf](https://github.com/anthropics/anthropic-bedrock-typescript/commit/443febf02c4c71b28934a776da0198fdd094de8f))


### Documentation

* fix missing async in readme code sample ([#67](https://github.com/anthropics/anthropic-bedrock-typescript/issues/67)) ([a6d20eb](https://github.com/anthropics/anthropic-bedrock-typescript/commit/a6d20eb8d3d4c6be9d92afd4eb7d93ea5c661094))
* **readme:** improve api reference ([#66](https://github.com/anthropics/anthropic-bedrock-typescript/issues/66)) ([f90bbaf](https://github.com/anthropics/anthropic-bedrock-typescript/commit/f90bbaf631e9ac34fb613a43ece1f489d82f04b8))

## 0.6.1 (2023-12-20)

Full Changelog: [v0.6.0...v0.6.1](https://github.com/anthropics/anthropic-bedrock-typescript/compare/v0.6.0...v0.6.1)

### Chores

* **ci:** run release workflow once per day ([#54](https://github.com/anthropics/anthropic-bedrock-typescript/issues/54)) ([b5072dd](https://github.com/anthropics/anthropic-bedrock-typescript/commit/b5072ddc0c068737cdca2dd6ecfcb231ac7edc1b))
* **deps:** update dependency ts-jest to v29.1.1 ([#55](https://github.com/anthropics/anthropic-bedrock-typescript/issues/55)) ([946a832](https://github.com/anthropics/anthropic-bedrock-typescript/commit/946a8326410b47143f2c9e611e6b62866d5d9734))
* **deps:** update jest ([#56](https://github.com/anthropics/anthropic-bedrock-typescript/issues/56)) ([492232d](https://github.com/anthropics/anthropic-bedrock-typescript/commit/492232de92f7d79b42869ca619cc85ae4a1b7966))
* **internal:** update test examples ([#50](https://github.com/anthropics/anthropic-bedrock-typescript/issues/50)) ([33132ea](https://github.com/anthropics/anthropic-bedrock-typescript/commit/33132eaab93f2fa39cc9e975df0b0323bb486395))
* update dependencies ([#53](https://github.com/anthropics/anthropic-bedrock-typescript/issues/53)) ([4a72bd7](https://github.com/anthropics/anthropic-bedrock-typescript/commit/4a72bd7f857a7024ff0e8caf574e92998431f4f3))
* update prettier ([#52](https://github.com/anthropics/anthropic-bedrock-typescript/issues/52)) ([acfe9e4](https://github.com/anthropics/anthropic-bedrock-typescript/commit/acfe9e46299275fc14c9a704c7c048c87e0e33db))


### Documentation

* reformat README.md ([#58](https://github.com/anthropics/anthropic-bedrock-typescript/issues/58)) ([050b328](https://github.com/anthropics/anthropic-bedrock-typescript/commit/050b328725d37f5a0876704b5754953967495ada))


### Refactors

* write jest config in typescript ([#57](https://github.com/anthropics/anthropic-bedrock-typescript/issues/57)) ([bbaa155](https://github.com/anthropics/anthropic-bedrock-typescript/commit/bbaa155e6377283a12258a470d4d10da3d9ebe54))


### Build System

* specify `packageManager: yarn` ([#51](https://github.com/anthropics/anthropic-bedrock-typescript/issues/51)) ([59453e5](https://github.com/anthropics/anthropic-bedrock-typescript/commit/59453e581ad770fb1d12a7458774d7427d0b90de))

## 0.6.0 (2023-12-06)

Full Changelog: [v0.5.2...v0.6.0](https://github.com/anthropics/anthropic-bedrock-typescript/compare/v0.5.2...v0.6.0)

### Features

* **client:** support reading the base url from an env variable ([#43](https://github.com/anthropics/anthropic-bedrock-typescript/issues/43)) ([783e9a1](https://github.com/anthropics/anthropic-bedrock-typescript/commit/783e9a1c6bacbc18028ee5e052758103e7c89453))


### Bug Fixes

* bump default request timeout to 10min to match documentation ([#47](https://github.com/anthropics/anthropic-bedrock-typescript/issues/47)) ([16d2d96](https://github.com/anthropics/anthropic-bedrock-typescript/commit/16d2d960dfb8076bb41d769a35aeaec564177238))

## 0.5.2 (2023-11-28)

Full Changelog: [v0.5.1...v0.5.2](https://github.com/anthropics/anthropic-bedrock-typescript/compare/v0.5.1...v0.5.2)

## 0.5.1 (2023-11-24)

Full Changelog: [v0.5.0...v0.5.1](https://github.com/anthropics/anthropic-bedrock-typescript/compare/v0.5.0...v0.5.1)

### Chores

* **internal:** remove file import and conditionally run prepare ([#39](https://github.com/anthropics/anthropic-bedrock-typescript/issues/39)) ([546295e](https://github.com/anthropics/anthropic-bedrock-typescript/commit/546295e63e5d0c373f7f84d36b98cf8094c2c5c8))

## 0.5.0 (2023-11-21)

Full Changelog: [v0.4.1...v0.5.0](https://github.com/anthropics/anthropic-bedrock-typescript/compare/v0.4.1...v0.5.0)

### Features

* allow installing package directly from github ([#37](https://github.com/anthropics/anthropic-bedrock-typescript/issues/37)) ([758b62f](https://github.com/anthropics/anthropic-bedrock-typescript/commit/758b62f86b7d62229f9f41c931c03eebc16d03fc))


### Chores

* **ci:** fix publish-npm ([#35](https://github.com/anthropics/anthropic-bedrock-typescript/issues/35)) ([03ca66d](https://github.com/anthropics/anthropic-bedrock-typescript/commit/03ca66d6a9b9d7fcc7f930c62535d162e46917ea))
* **internal:** don't call prepare in dist ([#38](https://github.com/anthropics/anthropic-bedrock-typescript/issues/38)) ([21038f6](https://github.com/anthropics/anthropic-bedrock-typescript/commit/21038f62cf3dafda7cf9f79d5694bd2e89392bc6))

## 0.4.1 (2023-11-14)

Full Changelog: [v0.4.0...v0.4.1](https://github.com/anthropics/anthropic-bedrock-typescript/compare/v0.4.0...v0.4.1)

### Chores

* **ci:** update release-please config ([#29](https://github.com/anthropics/anthropic-bedrock-typescript/issues/29)) ([9f932f7](https://github.com/anthropics/anthropic-bedrock-typescript/commit/9f932f7091d3c0a31c650d326c7669ee90c534ee))
* **docs:** fix github links ([#31](https://github.com/anthropics/anthropic-bedrock-typescript/issues/31)) ([8c433fd](https://github.com/anthropics/anthropic-bedrock-typescript/commit/8c433fdde7c618afc7b5ecd32c85eb06dd0f048b))
* **internal:** update APIResource structure ([#34](https://github.com/anthropics/anthropic-bedrock-typescript/issues/34)) ([c85a2e3](https://github.com/anthropics/anthropic-bedrock-typescript/commit/c85a2e3bfa8d95ea2d7444d32ba884984b7e61e7))
* **internal:** update jest config ([#33](https://github.com/anthropics/anthropic-bedrock-typescript/issues/33)) ([a46da67](https://github.com/anthropics/anthropic-bedrock-typescript/commit/a46da679e8f40600fa37c0de3a90c633b78356eb))
* **internal:** update tsconfig ([#32](https://github.com/anthropics/anthropic-bedrock-typescript/issues/32)) ([b9295df](https://github.com/anthropics/anthropic-bedrock-typescript/commit/b9295dff2a3aa721f057d64dfc41eaf7d6bd0f6c))

## 0.4.0 (2023-11-04)

Full Changelog: [v0.3.0...v0.4.0](https://github.com/anthropics/anthropic-bedrock-typescript/compare/v0.3.0...v0.4.0)

### Features

* **client:** allow binary returns ([#27](https://github.com/anthropics/anthropic-bedrock-typescript/issues/27)) ([d9e84a1](https://github.com/anthropics/anthropic-bedrock-typescript/commit/d9e84a1f8d25d43f3eb256723bfb89cf0d354453))
* **github:** include a devcontainer setup ([#26](https://github.com/anthropics/anthropic-bedrock-typescript/issues/26)) ([c37cf14](https://github.com/anthropics/anthropic-bedrock-typescript/commit/c37cf14409464bceeacb97cb6f8e098a1bfefd2d))


### Chores

* **internal:** update gitignore ([#22](https://github.com/anthropics/anthropic-bedrock-typescript/issues/22)) ([d448991](https://github.com/anthropics/anthropic-bedrock-typescript/commit/d448991a6f24c0a50f686380957473bfa2cd13b7))
* small cleanups ([#25](https://github.com/anthropics/anthropic-bedrock-typescript/issues/25)) ([d18cfcb](https://github.com/anthropics/anthropic-bedrock-typescript/commit/d18cfcb28428ca944b423ea515d046720553c28d))


### Documentation

* document customizing fetch ([#28](https://github.com/anthropics/anthropic-bedrock-typescript/issues/28)) ([878bd1b](https://github.com/anthropics/anthropic-bedrock-typescript/commit/878bd1b240dc319e3ab37b7e8b4fe96eb155688a))
* fix github links ([#24](https://github.com/anthropics/anthropic-bedrock-typescript/issues/24)) ([9560ba7](https://github.com/anthropics/anthropic-bedrock-typescript/commit/9560ba7c165d373a23d77d8d14a864845e2dc721))

## 0.3.0 (2023-10-25)

Full Changelog: [v0.2.0...v0.3.0](https://github.com/anthropics/anthropic-bedrock-typescript/compare/v0.2.0...v0.3.0)

### Features

* **client:** adjust retry behavior to be exponential backoff ([#18](https://github.com/anthropics/anthropic-bedrock-typescript/issues/18)) ([51d3a6e](https://github.com/anthropics/anthropic-bedrock-typescript/commit/51d3a6e8ab71ba935bd71b497d83df1896835199))


### Bug Fixes

* typo in build script ([#21](https://github.com/anthropics/anthropic-bedrock-typescript/issues/21)) ([b86502d](https://github.com/anthropics/anthropic-bedrock-typescript/commit/b86502d913b2d607c49db9fc1c5656d2a089e7a9))

## 0.2.0 (2023-10-19)

Full Changelog: [v0.1.2...v0.2.0](https://github.com/anthropics/anthropic-bedrock-typescript/compare/v0.1.2...v0.2.0)

### Features

* handle 204 No Content gracefully ([#17](https://github.com/anthropics/anthropic-bedrock-typescript/issues/17)) ([f11420b](https://github.com/anthropics/anthropic-bedrock-typescript/commit/f11420b2a9e2b9a127194bd811708f9f010447b5))

## 0.1.2 (2023-10-17)

Full Changelog: [v0.1.1...v0.1.2](https://github.com/anthropics/anthropic-bedrock-typescript/compare/v0.1.1...v0.1.2)

### Bug Fixes

* import web-streams-polyfill without overriding globals ([#13](https://github.com/anthropics/anthropic-bedrock-typescript/issues/13)) ([30db709](https://github.com/anthropics/anthropic-bedrock-typescript/commit/30db7098fea0154c8dcb484bfee2ed5c4ec946aa))

## 0.1.1 (2023-10-16)

Full Changelog: [v0.1.0...v0.1.1](https://github.com/anthropics/anthropic-bedrock-typescript/compare/v0.1.0...v0.1.1)

### Bug Fixes

* improve status code in error messages ([#9](https://github.com/anthropics/anthropic-bedrock-typescript/issues/9)) ([aa3f1b0](https://github.com/anthropics/anthropic-bedrock-typescript/commit/aa3f1b01ee5d9161c793f3f263fc5b297d1d1258))


### Chores

* add case insensitive get header function ([#4](https://github.com/anthropics/anthropic-bedrock-typescript/issues/4)) ([b7309b1](https://github.com/anthropics/anthropic-bedrock-typescript/commit/b7309b10201e048f726993c70bbf075f6927cabe))
* **internal:** add debug logs for stream responses ([#8](https://github.com/anthropics/anthropic-bedrock-typescript/issues/8)) ([b8763a7](https://github.com/anthropics/anthropic-bedrock-typescript/commit/b8763a73376e2a1ddb9073b649d4aacfad27bf69))
* update comment ([#6](https://github.com/anthropics/anthropic-bedrock-typescript/issues/6)) ([7361f09](https://github.com/anthropics/anthropic-bedrock-typescript/commit/7361f09aa5430d8dcd8193dc599ea9fa75d17e4e))


### Documentation

* organisation -&gt; organization (UK to US English) ([#11](https://github.com/anthropics/anthropic-bedrock-typescript/issues/11)) ([5cbea8e](https://github.com/anthropics/anthropic-bedrock-typescript/commit/5cbea8e9ef936b314617765d7bc2dbb2c3d98eac))

## 0.1.0 (2023-10-12)

Full Changelog: [v0.0.1...v0.1.0](https://github.com/anthropics/anthropic-bedrock-typescript/compare/v0.0.1...v0.1.0)

### Features

* **init:** initial commit ([#1](https://github.com/anthropics/anthropic-bedrock-typescript/issues/1)) ([17f9073](https://github.com/anthropics/anthropic-bedrock-typescript/commit/17f9073f1545f9f578e67c56f827322a7691ca21))
