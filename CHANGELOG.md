# Changelog

## 0.36.0 (2025-01-21)

Full Changelog: [sdk-v0.35.0...sdk-v0.36.0](https://github.com/anthropics/anthropic-sdk-typescript/compare/sdk-v0.35.0...sdk-v0.36.0)

### ⚠ BREAKING CHANGES

* **api:** messages is generally available ([#287](https://github.com/anthropics/anthropic-sdk-typescript/issues/287))

### Features

* add back compat alias for InputJsonDelta ([711d1d5](https://github.com/anthropics/anthropic-sdk-typescript/commit/711d1d54e111ad4f0a0eaef223652bfd4b942b7c))
* add beta message streaming helpers ([#655](https://github.com/anthropics/anthropic-sdk-typescript/issues/655)) ([a63cb88](https://github.com/anthropics/anthropic-sdk-typescript/commit/a63cb88f49a302583720aaf6c1026d038b16ffb6))
* **api/types:** add stream event type aliases with a Raw prefix ([#428](https://github.com/anthropics/anthropic-sdk-typescript/issues/428)) ([590f45a](https://github.com/anthropics/anthropic-sdk-typescript/commit/590f45a4c475135b25fb55d2c72744ddcf869004))
* **api:** add `tool_choice` param, image block params inside `tool_result.content`, and streaming for `tool_use` blocks ([#418](https://github.com/anthropics/anthropic-sdk-typescript/issues/418)) ([2c7cc70](https://github.com/anthropics/anthropic-sdk-typescript/commit/2c7cc70ca841bcb20f133d528fc8f1336e0a3a8c))
* **api:** add enum to model param for message ([#315](https://github.com/anthropics/anthropic-sdk-typescript/issues/315)) ([672d977](https://github.com/anthropics/anthropic-sdk-typescript/commit/672d9771c52679a0317ae6159e2efa295f84cd6b))
* **api:** add haiku model ([#333](https://github.com/anthropics/anthropic-sdk-typescript/issues/333)) ([446353b](https://github.com/anthropics/anthropic-sdk-typescript/commit/446353b354298cd43a4d288359bd7fb0067e83d9))
* **api:** add message batch delete endpoint ([#640](https://github.com/anthropics/anthropic-sdk-typescript/issues/640)) ([ec607ec](https://github.com/anthropics/anthropic-sdk-typescript/commit/ec607ec6fdf585602a4166850b1f8cd74d5bb7d1))
* **api:** add message batches api ([1c404b2](https://github.com/anthropics/anthropic-sdk-typescript/commit/1c404b213e23440a5728d7266b90269fbf0d88ef))
* **api:** add message token counting & PDFs support ([#582](https://github.com/anthropics/anthropic-sdk-typescript/issues/582)) ([affdd31](https://github.com/anthropics/anthropic-sdk-typescript/commit/affdd31f99ca7bfce1fe277403c35490bf432765))
* **api:** add new claude-3-5-sonnet-20240620 model ([#438](https://github.com/anthropics/anthropic-sdk-typescript/issues/438)) ([6868e83](https://github.com/anthropics/anthropic-sdk-typescript/commit/6868e83511ac112094303e9b432178ee9150f329))
* **api:** add new haiku model ([#587](https://github.com/anthropics/anthropic-sdk-typescript/issues/587)) ([f7913f7](https://github.com/anthropics/anthropic-sdk-typescript/commit/f7913f795a792030515e09991d5a3513002cd7ea))
* **api:** add new model and `computer-use-2024-10-22` beta ([b9fa45a](https://github.com/anthropics/anthropic-sdk-typescript/commit/b9fa45a04db46fcf3a1b046f589ae55a081e15df))
* **api:** add new usage response fields ([#281](https://github.com/anthropics/anthropic-sdk-typescript/issues/281)) ([22c4047](https://github.com/anthropics/anthropic-sdk-typescript/commit/22c404766574198fb636dd8537867835d7ef8b3c))
* **api:** add prompt caching beta ([5a27430](https://github.com/anthropics/anthropic-sdk-typescript/commit/5a27430a97bbdfa418e64ea33269ad33e8212f9c))
* **api:** general availability updates ([7fd4830](https://github.com/anthropics/anthropic-sdk-typescript/commit/7fd4830dae44ab66f6125728d4b18eeba8d58219))
* **api:** messages is generally available ([#287](https://github.com/anthropics/anthropic-sdk-typescript/issues/287)) ([57b7135](https://github.com/anthropics/anthropic-sdk-typescript/commit/57b713508614e9d125c22d64c4c5fabaa7c75ad8))
* **api:** support disabling parallel tool use ([#540](https://github.com/anthropics/anthropic-sdk-typescript/issues/540)) ([4618d3e](https://github.com/anthropics/anthropic-sdk-typescript/commit/4618d3e6731f2141e01d07128bd170e41dc9bcdd))
* **api:** tool use beta ([#374](https://github.com/anthropics/anthropic-sdk-typescript/issues/374)) ([5bcaddb](https://github.com/anthropics/anthropic-sdk-typescript/commit/5bcaddbd396fa81e9b65bf2ce3b2917affae5c0a))
* **api:** tool use is GA and available on 3P ([#429](https://github.com/anthropics/anthropic-sdk-typescript/issues/429)) ([5d2b183](https://github.com/anthropics/anthropic-sdk-typescript/commit/5d2b183b6dc4f13395f9e6805d936ec2140c57d0))
* **bedrock:** add beta.messages.create() method ([faf8484](https://github.com/anthropics/anthropic-sdk-typescript/commit/faf84848e42ec02994003283bf6178aa55233531))
* **bedrock:** add messages API ([#305](https://github.com/anthropics/anthropic-sdk-typescript/issues/305)) ([072a5ed](https://github.com/anthropics/anthropic-sdk-typescript/commit/072a5ed642cbbdeee45532359d1ee5baea0b78fd))
* **bedrock:** support tools ([2aeff91](https://github.com/anthropics/anthropic-sdk-typescript/commit/2aeff9187f3ebfa010c95715814a7e34f85ac6dd))
* **client:** add ._request_id property to object responses ([#596](https://github.com/anthropics/anthropic-sdk-typescript/issues/596)) ([14a4a68](https://github.com/anthropics/anthropic-sdk-typescript/commit/14a4a687d243e47a8583160772ec9ccad4c7e1d9))
* **client:** add streaming helpers ([a3ff1ff](https://github.com/anthropics/anthropic-sdk-typescript/commit/a3ff1ff797bc929bec89a46563674d83cbd83284))
* **client:** add support for browser usage ([#504](https://github.com/anthropics/anthropic-sdk-typescript/issues/504)) ([e91d291](https://github.com/anthropics/anthropic-sdk-typescript/commit/e91d2918dfc42f5e146a0a86d99dfd4daae6fab1))
* **client:** allow overriding retry count header ([#536](https://github.com/anthropics/anthropic-sdk-typescript/issues/536)) ([e59d283](https://github.com/anthropics/anthropic-sdk-typescript/commit/e59d28375b2e62e05e6bd2904d2669d36c591099))
* **client:** make request-id header more accessible ([#462](https://github.com/anthropics/anthropic-sdk-typescript/issues/462)) ([6caae55](https://github.com/anthropics/anthropic-sdk-typescript/commit/6caae555ee347be8d99a3f3c6e1d479499339e9a))
* **client:** send retry count header ([#533](https://github.com/anthropics/anthropic-sdk-typescript/issues/533)) ([02d0754](https://github.com/anthropics/anthropic-sdk-typescript/commit/02d075455a641fc5e239a1a6c5428c5894e148ff))
* **internal:** make git install file structure match npm ([#617](https://github.com/anthropics/anthropic-sdk-typescript/issues/617)) ([3b75442](https://github.com/anthropics/anthropic-sdk-typescript/commit/3b754422bb67dbec41e7281695824c770e6b6daf))
* **messages:** add support for image inputs ([#303](https://github.com/anthropics/anthropic-sdk-typescript/issues/303)) ([1b87d9e](https://github.com/anthropics/anthropic-sdk-typescript/commit/1b87d9ea141defa81fa31ee47673b47e19cc8cb1))
* **stream:** add `.withResponse()` ([#654](https://github.com/anthropics/anthropic-sdk-typescript/issues/654)) ([85a763c](https://github.com/anthropics/anthropic-sdk-typescript/commit/85a763c3899d8055645ac6996527d8e39cb0ba96))
* **streaming:** add `.request_id` getter ([e1fd091](https://github.com/anthropics/anthropic-sdk-typescript/commit/e1fd091cc32cc931d5366f508f5bef3ef1d6323f))
* **streaming:** add tools support ([a1c2fbd](https://github.com/anthropics/anthropic-sdk-typescript/commit/a1c2fbd4a0d6772de55fb86bc54baeadc2252d4a))
* support `application/octet-stream` request bodies ([#436](https://github.com/anthropics/anthropic-sdk-typescript/issues/436)) ([0ee32d7](https://github.com/anthropics/anthropic-sdk-typescript/commit/0ee32d718c3f45c63541e2c81fbb0dc21d47fe8c))
* **vertex:** add beta.messages.create() ([08a8928](https://github.com/anthropics/anthropic-sdk-typescript/commit/08a8928fb1fa701f4330720ea2e9d4db81b6b17a))
* **vertex:** add support for google vertex ([#265](https://github.com/anthropics/anthropic-sdk-typescript/issues/265)) ([96f9b55](https://github.com/anthropics/anthropic-sdk-typescript/commit/96f9b55feb9059184a2a1c0ec52c5f8dad862a32))
* **vertex:** add support for overriding google auth ([#338](https://github.com/anthropics/anthropic-sdk-typescript/issues/338)) ([f268237](https://github.com/anthropics/anthropic-sdk-typescript/commit/f26823762219f78dce487165331312612c4399b9))
* **vertex:** api is no longer in private beta ([#344](https://github.com/anthropics/anthropic-sdk-typescript/issues/344)) ([a151de7](https://github.com/anthropics/anthropic-sdk-typescript/commit/a151de7a9416b899a4eb22b21978f2b03f087396))
* **vertex:** support token counting ([a4a3729](https://github.com/anthropics/anthropic-sdk-typescript/commit/a4a372947b250e195f5c45ffd928a2d966b23f0d))
* **vertex:** support tools ([d9e9e3c](https://github.com/anthropics/anthropic-sdk-typescript/commit/d9e9e3c789d9a90c247bdade764d60e9fd8a8add))


### Bug Fixes

* allow body type in RequestOptions to be null ([#259](https://github.com/anthropics/anthropic-sdk-typescript/issues/259)) ([55f19d9](https://github.com/anthropics/anthropic-sdk-typescript/commit/55f19d97fcf79cc4bb0c48223cc0a58c7aa5a0be))
* allow git imports for pnpm ([#433](https://github.com/anthropics/anthropic-sdk-typescript/issues/433)) ([729b0bb](https://github.com/anthropics/anthropic-sdk-typescript/commit/729b0bb36298189e341a04d3100f6d0abd5652c8))
* **api:** add string to tool result block ([#448](https://github.com/anthropics/anthropic-sdk-typescript/issues/448)) ([d67f287](https://github.com/anthropics/anthropic-sdk-typescript/commit/d67f2877a992eb06b25b5c7c51840de85d5fdbc1))
* **bedrock:** correct messages beta handling ([f34d67a](https://github.com/anthropics/anthropic-sdk-typescript/commit/f34d67abca1270f04f9bbf6ce430ce67b36d4932))
* **bedrock:** don't mutate request body inputs ([4523ca9](https://github.com/anthropics/anthropic-sdk-typescript/commit/4523ca92b0fa194c2de0ac8bbc7e66873ec5e817))
* **beta:** merge betas param with the default value ([#556](https://github.com/anthropics/anthropic-sdk-typescript/issues/556)) ([d713fcc](https://github.com/anthropics/anthropic-sdk-typescript/commit/d713fcc90f27c5dda484130e13220a0c9eaefae1))
* **ci:** ignore stainless-app edits to release PR title ([#258](https://github.com/anthropics/anthropic-sdk-typescript/issues/258)) ([e92bfaf](https://github.com/anthropics/anthropic-sdk-typescript/commit/e92bfafc39a3b587e3eeaee1f19766b4fb3be49c))
* **client:** correct File construction from node-fetch Responses ([#518](https://github.com/anthropics/anthropic-sdk-typescript/issues/518)) ([859d585](https://github.com/anthropics/anthropic-sdk-typescript/commit/859d585a15961c2d55f669b0bd7da39e162ed94d))
* **client:** correctly send deno version header ([#354](https://github.com/anthropics/anthropic-sdk-typescript/issues/354)) ([1b69cee](https://github.com/anthropics/anthropic-sdk-typescript/commit/1b69cee5077784a7d356007fc4a8e3b713a84e15))
* **client:** normalize method ([#639](https://github.com/anthropics/anthropic-sdk-typescript/issues/639)) ([f55e419](https://github.com/anthropics/anthropic-sdk-typescript/commit/f55e4192b1fe232a406e3ba79258ededad4e7343))
* **client:** respect x-stainless-retry-count default headers ([#562](https://github.com/anthropics/anthropic-sdk-typescript/issues/562)) ([ef52b8d](https://github.com/anthropics/anthropic-sdk-typescript/commit/ef52b8d7afd23feb923dc6a4f1da2f2cfd95a13c))
* **compat:** remove ReadableStream polyfill redundant since node v16 ([#478](https://github.com/anthropics/anthropic-sdk-typescript/issues/478)) ([5e9ac2c](https://github.com/anthropics/anthropic-sdk-typescript/commit/5e9ac2c42872ea60e2e5e1c94685fba60a7044bc))
* **countTokens:** correctly set beta header ([3002c2e](https://github.com/anthropics/anthropic-sdk-typescript/commit/3002c2ede94e7f380dfffd7c089b6d56aa507958))
* **docs:** add missing await to pagination example ([#609](https://github.com/anthropics/anthropic-sdk-typescript/issues/609)) ([0a9ed2b](https://github.com/anthropics/anthropic-sdk-typescript/commit/0a9ed2ba5703ac6222417a7e31ded39a961bcb70))
* **docs:** correct results return type ([#657](https://github.com/anthropics/anthropic-sdk-typescript/issues/657)) ([4378d07](https://github.com/anthropics/anthropic-sdk-typescript/commit/4378d0701e1e0049ea0161a8423a615412ccbe8e))
* don't require deno to run build-deno ([#586](https://github.com/anthropics/anthropic-sdk-typescript/issues/586)) ([21fa500](https://github.com/anthropics/anthropic-sdk-typescript/commit/21fa50056c08043ed4b7f700087da805627426a8))
* **examples:** add token counting example ([151fe16](https://github.com/anthropics/anthropic-sdk-typescript/commit/151fe16732691a659c487927f7f4496418b86e9a))
* handle process.env being undefined in debug func ([#351](https://github.com/anthropics/anthropic-sdk-typescript/issues/351)) ([bf942f8](https://github.com/anthropics/anthropic-sdk-typescript/commit/bf942f87149e126d36e4451d1d91719dbfe0a718))
* **internal:** make toFile use input file's options ([#343](https://github.com/anthropics/anthropic-sdk-typescript/issues/343)) ([3ef7ac4](https://github.com/anthropics/anthropic-sdk-typescript/commit/3ef7ac4a8f62f5eef2d6105c68833cb71ff1eb67))
* **internal:** support pnpm git installs ([#579](https://github.com/anthropics/anthropic-sdk-typescript/issues/579)) ([4f861d0](https://github.com/anthropics/anthropic-sdk-typescript/commit/4f861d0bdc6f3b22ae63926aa9071931b58b0e57))
* **MessageStream:** handle errors more gracefully in async iterator ([#301](https://github.com/anthropics/anthropic-sdk-typescript/issues/301)) ([95232ed](https://github.com/anthropics/anthropic-sdk-typescript/commit/95232eda6bcdf420fbf85625c7ff6baabab60f08))
* **package:** revert recent client file change ([#409](https://github.com/anthropics/anthropic-sdk-typescript/issues/409)) ([26147bf](https://github.com/anthropics/anthropic-sdk-typescript/commit/26147bf397b88ac91fe2251da843163094b6dd3f))
* **partial-json:** don't error on unknown tokens ([75e6dd9](https://github.com/anthropics/anthropic-sdk-typescript/commit/75e6dd927464d27baa9992f9769d307fec3e5ad5))
* **partial-json:** handle `null` token properly ([8479a30](https://github.com/anthropics/anthropic-sdk-typescript/commit/8479a3073fe74bf13c28125f6e7bb60e3f67124f))
* send correct Accept header for certain endpoints ([#651](https://github.com/anthropics/anthropic-sdk-typescript/issues/651)) ([5668abf](https://github.com/anthropics/anthropic-sdk-typescript/commit/5668abf1f81a899764ecd1abaede07b45e18e712))
* **streaming:** correct accumulation of output tokens ([#361](https://github.com/anthropics/anthropic-sdk-typescript/issues/361)) ([6e78091](https://github.com/anthropics/anthropic-sdk-typescript/commit/6e780919f5bef447fcaa61e326d58234873e951e))
* **streaming:** correct error message serialisation ([#524](https://github.com/anthropics/anthropic-sdk-typescript/issues/524)) ([45b0018](https://github.com/anthropics/anthropic-sdk-typescript/commit/45b0018ac6561f4dc832e04ecf2bac5f0ba10ec8))
* **streaming:** correctly handle trailing new lines in byte chunks ([#317](https://github.com/anthropics/anthropic-sdk-typescript/issues/317)) ([c5385a1](https://github.com/anthropics/anthropic-sdk-typescript/commit/c5385a1b57c635a5b07ca31cc356d0e75903aa8f))
* **streaming:** handle special line characters and fix multi-byte character decoding ([#370](https://github.com/anthropics/anthropic-sdk-typescript/issues/370)) ([255c91f](https://github.com/anthropics/anthropic-sdk-typescript/commit/255c91ff2be483a63b7d238dc4457f2b60dd7c4b))
* **types:** accept undefined for optional client options ([#257](https://github.com/anthropics/anthropic-sdk-typescript/issues/257)) ([3af0266](https://github.com/anthropics/anthropic-sdk-typescript/commit/3af02660f57ce195073255c65df0be2f0ab0f5e3))
* **types:** add missing token-counting-2024-11-01 ([f99a700](https://github.com/anthropics/anthropic-sdk-typescript/commit/f99a700c71029bdde1b13b3b14cac3d02b96edd4))
* **types:** add missing token-counting-2024-11-01 ([#583](https://github.com/anthropics/anthropic-sdk-typescript/issues/583)) ([86c5ade](https://github.com/anthropics/anthropic-sdk-typescript/commit/86c5adebf10927609fea29afc4ff7c714ceae50b))
* **types:** avoid errors on certain TS versions ([8a8a23f](https://github.com/anthropics/anthropic-sdk-typescript/commit/8a8a23f847f4a1d4305c7fb633819fb35c95fb79))
* **types:** correct typo claude-2.1' to claude-2.1 ([#352](https://github.com/anthropics/anthropic-sdk-typescript/issues/352)) ([01a1fa0](https://github.com/anthropics/anthropic-sdk-typescript/commit/01a1fa080b6a6a9a7bc6ff58cfdb33fe8e101555))
* **types:** correctly mark type as a required property in requests ([#371](https://github.com/anthropics/anthropic-sdk-typescript/issues/371)) ([06fc0f7](https://github.com/anthropics/anthropic-sdk-typescript/commit/06fc0f74f7769628f4001b9b739c463cd84e7e6f))
* **types:** remove anthropic-instant-1.2 model ([#599](https://github.com/anthropics/anthropic-sdk-typescript/issues/599)) ([0f9db5c](https://github.com/anthropics/anthropic-sdk-typescript/commit/0f9db5c0b9ab7ca4d08a675237a893b66c281850))
* **types:** remove leftover polyfill usage ([#532](https://github.com/anthropics/anthropic-sdk-typescript/issues/532)) ([369bac0](https://github.com/anthropics/anthropic-sdk-typescript/commit/369bac0bef84605c7dd50f1f9444fd9f32cb1475))
* **types:** remove misleading betas TypedDict property for the Batch API ([#559](https://github.com/anthropics/anthropic-sdk-typescript/issues/559)) ([d80b407](https://github.com/anthropics/anthropic-sdk-typescript/commit/d80b4077dd028fc263ec3f79d2cb5df3c51d1874))
* **uploads:** avoid making redundant memory copies ([#520](https://github.com/anthropics/anthropic-sdk-typescript/issues/520)) ([abdb763](https://github.com/anthropics/anthropic-sdk-typescript/commit/abdb7632cb47ed4014c8c47b3117040d7d37abf6))
* use default base url if BASE_URL env var is blank ([#250](https://github.com/anthropics/anthropic-sdk-typescript/issues/250)) ([76b1429](https://github.com/anthropics/anthropic-sdk-typescript/commit/76b1429d0185a7915da19d88aa856559c516bbfd))
* use relative paths ([#475](https://github.com/anthropics/anthropic-sdk-typescript/issues/475)) ([dfd0eca](https://github.com/anthropics/anthropic-sdk-typescript/commit/dfd0ecaf8981261678b9fe6b8667c9195f8b623b))
* **vertex:** add beta.messages.countTokens method ([2cbeabc](https://github.com/anthropics/anthropic-sdk-typescript/commit/2cbeabc6f0175297c98b5d706a0038d793150e8e))
* **vertex:** correct core client dependency constraint ([#384](https://github.com/anthropics/anthropic-sdk-typescript/issues/384)) ([10b9334](https://github.com/anthropics/anthropic-sdk-typescript/commit/10b93342c4b18a43797f078b66164fa31314334b))
* **vertex:** correct messages beta handling ([a41193d](https://github.com/anthropics/anthropic-sdk-typescript/commit/a41193d112f47faaae88872e8764b631dbad1941))
* **vertex:** don't mutate request body inputs ([2709c1f](https://github.com/anthropics/anthropic-sdk-typescript/commit/2709c1fb255282321fab296e709651a79017fe37))
* **vertex:** remove `anthropic_version` deletion for token counting ([beefeb7](https://github.com/anthropics/anthropic-sdk-typescript/commit/beefeb74060196c564de14ddb6a39734f7b0352e))


### Reverts

* disable isolatedModules and change imports ([#575](https://github.com/anthropics/anthropic-sdk-typescript/issues/575)) ([007ff79](https://github.com/anthropics/anthropic-sdk-typescript/commit/007ff79247dfbecb6708402f2e0847c022c6d1e1))


### Chores

* add .keep files for examples and custom code directories ([#249](https://github.com/anthropics/anthropic-sdk-typescript/issues/249)) ([6fa9ad2](https://github.com/anthropics/anthropic-sdk-typescript/commit/6fa9ad20e512db0fe2bc6a7c5e9150206bf05f8d))
* **api:** add title ([#564](https://github.com/anthropics/anthropic-sdk-typescript/issues/564)) ([665ebae](https://github.com/anthropics/anthropic-sdk-typescript/commit/665ebaee0b3a8d1ca85e7935b857ab9e00586a65))
* **api:** deprecate claude-1 models ([c7557f1](https://github.com/anthropics/anthropic-sdk-typescript/commit/c7557f14ece5a693505c27ccf562e06472ab60f1))
* **api:** update spec version ([#607](https://github.com/anthropics/anthropic-sdk-typescript/issues/607)) ([08ad02f](https://github.com/anthropics/anthropic-sdk-typescript/commit/08ad02fd72e3097da9daf89060ca5f66065ee113))
* **api:** update spec version ([#629](https://github.com/anthropics/anthropic-sdk-typescript/issues/629)) ([1f072f8](https://github.com/anthropics/anthropic-sdk-typescript/commit/1f072f886af1edda47da0ee7c2d3041b15ff232e))
* **bedrock,vertex:** remove unsupported countTokens method ([#597](https://github.com/anthropics/anthropic-sdk-typescript/issues/597)) ([6f6db16](https://github.com/anthropics/anthropic-sdk-typescript/commit/6f6db164d2526c2fb272151f4d68140da27ce1ea))
* **bedrock:** move bedrock SDK to the main repo ([#274](https://github.com/anthropics/anthropic-sdk-typescript/issues/274)) ([1a565fe](https://github.com/anthropics/anthropic-sdk-typescript/commit/1a565feddd19c3dbe62f087fc9f13520bb69fc0e))
* **bedrock:** remove unsupported methods ([8bb04ed](https://github.com/anthropics/anthropic-sdk-typescript/commit/8bb04ed2370c894b080d56d37e960ad4c3dc5925))
* **bedrock:** use `chunk` for internal SSE parsing instead of `completion` ([#472](https://github.com/anthropics/anthropic-sdk-typescript/issues/472)) ([9515f60](https://github.com/anthropics/anthropic-sdk-typescript/commit/9515f6035e8b79a5335286c8cc1591d83ee51216))
* better object fallback behaviour for casting errors ([#503](https://github.com/anthropics/anthropic-sdk-typescript/issues/503)) ([ab12feb](https://github.com/anthropics/anthropic-sdk-typescript/commit/ab12feb1f6a6987ede24507844c50fa8682c01f4))
* bump testing data uri ([#637](https://github.com/anthropics/anthropic-sdk-typescript/issues/637)) ([135cb8b](https://github.com/anthropics/anthropic-sdk-typescript/commit/135cb8b68a2bd802e94b0885b3a1e8af09f76775))
* **ci:** add CODEOWNERS file ([#498](https://github.com/anthropics/anthropic-sdk-typescript/issues/498)) ([45ae01b](https://github.com/anthropics/anthropic-sdk-typescript/commit/45ae01b24c08c9de316999e129ab8b6e8442c11d))
* **ci:** also run workflows for PRs targeting `next` ([#464](https://github.com/anthropics/anthropic-sdk-typescript/issues/464)) ([c443e9f](https://github.com/anthropics/anthropic-sdk-typescript/commit/c443e9fb4c331fa9a24b4374c2c4acfa42384143))
* **ci:** bump prism mock server version ([#490](https://github.com/anthropics/anthropic-sdk-typescript/issues/490)) ([686ced5](https://github.com/anthropics/anthropic-sdk-typescript/commit/686ced5275df8294886102a5709ad5f0c78657d9))
* **ci:** check for build errors ([#511](https://github.com/anthropics/anthropic-sdk-typescript/issues/511)) ([8299bec](https://github.com/anthropics/anthropic-sdk-typescript/commit/8299becb8e1ff2a334b1b4f1d5ae1b84cb629ba4))
* **ci:** fix publish packages script ([#272](https://github.com/anthropics/anthropic-sdk-typescript/issues/272)) ([a9fef06](https://github.com/anthropics/anthropic-sdk-typescript/commit/a9fef06b75c24ea7a0a810e36827371323c21874))
* **ci:** install deps via ./script/bootstrap ([#515](https://github.com/anthropics/anthropic-sdk-typescript/issues/515)) ([38d0481](https://github.com/anthropics/anthropic-sdk-typescript/commit/38d048130fa33ae2a0966a2cd0040a109fde5c4d))
* **ci:** minor changes ([#488](https://github.com/anthropics/anthropic-sdk-typescript/issues/488)) ([61c327f](https://github.com/anthropics/anthropic-sdk-typescript/commit/61c327f2c39d44073206b5427b67889056fede08))
* **ci:** remove unneeded workflow ([#594](https://github.com/anthropics/anthropic-sdk-typescript/issues/594)) ([4890611](https://github.com/anthropics/anthropic-sdk-typescript/commit/4890611b27c28c58bae4a4daad0cd14fadd4c7a4))
* **ci:** update actions/setup-node action to v4 ([#295](https://github.com/anthropics/anthropic-sdk-typescript/issues/295)) ([ad24bde](https://github.com/anthropics/anthropic-sdk-typescript/commit/ad24bde8528fc43c6549446cd7cc9bca8acb8472))
* **client:** drop unused devDependency ([#610](https://github.com/anthropics/anthropic-sdk-typescript/issues/610)) ([9f07abc](https://github.com/anthropics/anthropic-sdk-typescript/commit/9f07abcdc40b9ae6dd341715a1b97341b3d89e43))
* deprecate more models ([ab8ed5f](https://github.com/anthropics/anthropic-sdk-typescript/commit/ab8ed5f89fdd1c6063b746df2f2f23f671a375ac))
* **deps:** bump yarn to v1.22.22 ([#369](https://github.com/anthropics/anthropic-sdk-typescript/issues/369)) ([9b7df0d](https://github.com/anthropics/anthropic-sdk-typescript/commit/9b7df0d944d241d73528dc45d9fcc34495e28acf))
* **deps:** remove unused dependency digest-fetch ([#368](https://github.com/anthropics/anthropic-sdk-typescript/issues/368)) ([62790cb](https://github.com/anthropics/anthropic-sdk-typescript/commit/62790cb93abd27d63c2d6678159803972dc20606))
* **docs/api:** update prompt caching helpers ([38e0959](https://github.com/anthropics/anthropic-sdk-typescript/commit/38e095991454794f1747e392e439adfc22322dda))
* **docs:** add SECURITY.md ([#411](https://github.com/anthropics/anthropic-sdk-typescript/issues/411)) ([a60bc90](https://github.com/anthropics/anthropic-sdk-typescript/commit/a60bc909889473b367758788efe7cba6d376abd7))
* **docs:** fix incorrect client var names ([#479](https://github.com/anthropics/anthropic-sdk-typescript/issues/479)) ([61625d2](https://github.com/anthropics/anthropic-sdk-typescript/commit/61625d216243e14a823c9a369972d3f551ddadb4))
* **docs:** fix typo ([#423](https://github.com/anthropics/anthropic-sdk-typescript/issues/423)) ([ec36603](https://github.com/anthropics/anthropic-sdk-typescript/commit/ec36603bcb1dc56b80bbcfdc34dccac694319e76))
* **docs:** mention install from git repo ([#302](https://github.com/anthropics/anthropic-sdk-typescript/issues/302)) ([1852a80](https://github.com/anthropics/anthropic-sdk-typescript/commit/1852a80df04331883eee3af566ae55e5ea49e1ec))
* **docs:** mention lack of support for web browser runtimes ([#468](https://github.com/anthropics/anthropic-sdk-typescript/issues/468)) ([879d9da](https://github.com/anthropics/anthropic-sdk-typescript/commit/879d9dab5bdc02b6bb63f52329f81ab6627e5d92))
* **docs:** minor update to formatting of API link in README ([#467](https://github.com/anthropics/anthropic-sdk-typescript/issues/467)) ([d28471d](https://github.com/anthropics/anthropic-sdk-typescript/commit/d28471db14d3d801f924c9af8c75f560cafb7e74))
* **docs:** remove references to old bedrock package ([#289](https://github.com/anthropics/anthropic-sdk-typescript/issues/289)) ([b2b0173](https://github.com/anthropics/anthropic-sdk-typescript/commit/b2b0173fed0477416fb35162dcff15756996ec30))
* **docs:** rename anthropic const to client ([#471](https://github.com/anthropics/anthropic-sdk-typescript/issues/471)) ([8274f4b](https://github.com/anthropics/anthropic-sdk-typescript/commit/8274f4bbace5afa5956c1788bb244bd57c7f5c0f))
* **docs:** update browser support information ([#522](https://github.com/anthropics/anthropic-sdk-typescript/issues/522)) ([02f0fc5](https://github.com/anthropics/anthropic-sdk-typescript/commit/02f0fc513dc694a9c5b7ab1d1a851fc798131e3f))
* **docs:** use client instead of package name in Node examples ([#469](https://github.com/anthropics/anthropic-sdk-typescript/issues/469)) ([4d899d9](https://github.com/anthropics/anthropic-sdk-typescript/commit/4d899d94aecc8f232742f531f1216bfcbb042a60))
* **examples:** minor formatting changes ([#491](https://github.com/anthropics/anthropic-sdk-typescript/issues/491)) ([7193564](https://github.com/anthropics/anthropic-sdk-typescript/commit/7193564cc21500f5f8fd88be035f79920a8a9df4))
* fix error handler in readme ([#307](https://github.com/anthropics/anthropic-sdk-typescript/issues/307)) ([2346840](https://github.com/anthropics/anthropic-sdk-typescript/commit/23468407acc9c7baaadb9501bcdacab881b60708))
* gitignore test server logs ([#451](https://github.com/anthropics/anthropic-sdk-typescript/issues/451)) ([c0cf3c1](https://github.com/anthropics/anthropic-sdk-typescript/commit/c0cf3c11b71f9303c9f945278b9d352d8ac41a10))
* improve browser error message ([#613](https://github.com/anthropics/anthropic-sdk-typescript/issues/613)) ([4307bef](https://github.com/anthropics/anthropic-sdk-typescript/commit/4307bef8c20ef38a4d0fea6a112f60021d9045d9))
* **interal:** make link to api.md relative ([#278](https://github.com/anthropics/anthropic-sdk-typescript/issues/278)) ([5d421e6](https://github.com/anthropics/anthropic-sdk-typescript/commit/5d421e633588c4ff859b60f0b38aec153b695ece))
* **internal:** add constant for default timeout ([#480](https://github.com/anthropics/anthropic-sdk-typescript/issues/480)) ([2877590](https://github.com/anthropics/anthropic-sdk-typescript/commit/2877590cd894a5bf4d8e36f00a63f7fb81ea3dbc))
* **internal:** add dev dependency ([#531](https://github.com/anthropics/anthropic-sdk-typescript/issues/531)) ([49ce796](https://github.com/anthropics/anthropic-sdk-typescript/commit/49ce796eb0b705a4825d84e4c7848c3052fca8cd))
* **internal:** add explicit type annotation to decoder ([#324](https://github.com/anthropics/anthropic-sdk-typescript/issues/324)) ([ee4fc22](https://github.com/anthropics/anthropic-sdk-typescript/commit/ee4fc228ce208a24bc4c716bf5e4097787c4c9fa))
* **internal:** add internal helpers & improve build scripts ([#261](https://github.com/anthropics/anthropic-sdk-typescript/issues/261)) ([102bc8c](https://github.com/anthropics/anthropic-sdk-typescript/commit/102bc8c319bb3ca0971baebae5b24718b665aae1))
* **internal:** add link to openapi spec ([#406](https://github.com/anthropics/anthropic-sdk-typescript/issues/406)) ([6537ba6](https://github.com/anthropics/anthropic-sdk-typescript/commit/6537ba6cec2f6ce8ba7a7c10a33f8245f5f33563))
* **internal:** add scripts/test and scripts/mock ([#403](https://github.com/anthropics/anthropic-sdk-typescript/issues/403)) ([3a89120](https://github.com/anthropics/anthropic-sdk-typescript/commit/3a89120500775d29d2cf394cb83448eee12c74e9))
* **internal:** add slightly better logging to scripts ([#415](https://github.com/anthropics/anthropic-sdk-typescript/issues/415)) ([6704d90](https://github.com/anthropics/anthropic-sdk-typescript/commit/6704d90e2f4321dce2375199c9ec3f6bfbdfe856))
* **internal:** add test ([#660](https://github.com/anthropics/anthropic-sdk-typescript/issues/660)) ([e670066](https://github.com/anthropics/anthropic-sdk-typescript/commit/e670066b42925a3bb84115a5ef1df3df70ea37f6))
* **internal:** add type ([#359](https://github.com/anthropics/anthropic-sdk-typescript/issues/359)) ([2a79781](https://github.com/anthropics/anthropic-sdk-typescript/commit/2a79781263265ad39bdfc19c3293756fdad2c55b))
* **internal:** bump cross-spawn to v7.0.6 ([#624](https://github.com/anthropics/anthropic-sdk-typescript/issues/624)) ([2f75798](https://github.com/anthropics/anthropic-sdk-typescript/commit/2f75798f0b9df3c26b5271aeadfc3be8f1bd16ad))
* **internal:** bump prism version ([#407](https://github.com/anthropics/anthropic-sdk-typescript/issues/407)) ([2e445e3](https://github.com/anthropics/anthropic-sdk-typescript/commit/2e445e3e267b2c25cda5808b8ea21c98b977b7f8))
* **internal:** bumps eslint and related dependencies ([#570](https://github.com/anthropics/anthropic-sdk-typescript/issues/570)) ([0f8b00c](https://github.com/anthropics/anthropic-sdk-typescript/commit/0f8b00c74fc08b8376ad1bcf7b406f650fdf28aa))
* **internal:** debug logging for retries; speculative retry-after-ms support ([#256](https://github.com/anthropics/anthropic-sdk-typescript/issues/256)) ([334edb6](https://github.com/anthropics/anthropic-sdk-typescript/commit/334edb66a75a2e214276344c24b8fb80dba57be8))
* **internal:** dependency updates ([#519](https://github.com/anthropics/anthropic-sdk-typescript/issues/519)) ([40ebb5f](https://github.com/anthropics/anthropic-sdk-typescript/commit/40ebb5f25ff5eb250699beaec41a016789bff1c8))
* **internal:** don't re-export streaming type ([#267](https://github.com/anthropics/anthropic-sdk-typescript/issues/267)) ([a5b0ab1](https://github.com/anthropics/anthropic-sdk-typescript/commit/a5b0ab18f4959e8cd28c7aab07509a3431180ab2))
* **internal:** enable building when git installed ([#279](https://github.com/anthropics/anthropic-sdk-typescript/issues/279)) ([fcdfc41](https://github.com/anthropics/anthropic-sdk-typescript/commit/fcdfc419bb11c0e88f44d1760267a67320b95472))
* **internal:** fix generated version numbers ([#413](https://github.com/anthropics/anthropic-sdk-typescript/issues/413)) ([471430d](https://github.com/anthropics/anthropic-sdk-typescript/commit/471430dc1bfc7317b737bf778bda45aa591b087e))
* **internal:** fix some typos ([#633](https://github.com/anthropics/anthropic-sdk-typescript/issues/633)) ([ed64904](https://github.com/anthropics/anthropic-sdk-typescript/commit/ed64904c1ae2bddba987675041c829ca03737841))
* **internal:** formatting ([#390](https://github.com/anthropics/anthropic-sdk-typescript/issues/390)) ([53738e2](https://github.com/anthropics/anthropic-sdk-typescript/commit/53738e2ce7a7875756b8375a2ac46e9ec0adb22c))
* **internal:** improve type signatures ([#247](https://github.com/anthropics/anthropic-sdk-typescript/issues/247)) ([266d32e](https://github.com/anthropics/anthropic-sdk-typescript/commit/266d32e7358c7ac52718ab2e8cc38d6d2fbe7587))
* **internal:** minor changes to tests ([#465](https://github.com/anthropics/anthropic-sdk-typescript/issues/465)) ([86c901d](https://github.com/anthropics/anthropic-sdk-typescript/commit/86c901dedd0ad2dbdb0856a5a4247b698da28438))
* **internal:** minor reformatting ([#444](https://github.com/anthropics/anthropic-sdk-typescript/issues/444)) ([f224eff](https://github.com/anthropics/anthropic-sdk-typescript/commit/f224effbce6dca31ce636b5e8c17d88c3ba5e241))
* **internal:** minor streaming updates ([#264](https://github.com/anthropics/anthropic-sdk-typescript/issues/264)) ([8e13801](https://github.com/anthropics/anthropic-sdk-typescript/commit/8e1380166915a85eb1c5459ea0c34e02bd264a43))
* **internal:** move client class to separate file ([#408](https://github.com/anthropics/anthropic-sdk-typescript/issues/408)) ([11304ca](https://github.com/anthropics/anthropic-sdk-typescript/commit/11304cafb551653e77be34336810dbbc7055b8e3))
* **internal:** move LineDecoder to a separate file ([#541](https://github.com/anthropics/anthropic-sdk-typescript/issues/541)) ([ef81591](https://github.com/anthropics/anthropic-sdk-typescript/commit/ef8159171a386f3faf27699e9b7b73b47ebcab25))
* **internal:** narrow type into stringifyQuery ([#253](https://github.com/anthropics/anthropic-sdk-typescript/issues/253)) ([2a3a126](https://github.com/anthropics/anthropic-sdk-typescript/commit/2a3a1268f29dfbbfe792bda88525b424deeeb346))
* **internal:** pass props through internal parser ([#549](https://github.com/anthropics/anthropic-sdk-typescript/issues/549)) ([d225d1d](https://github.com/anthropics/anthropic-sdk-typescript/commit/d225d1d58b7b859370f550022aff0a8f95fc988a))
* **internal:** refactor release environment script ([#294](https://github.com/anthropics/anthropic-sdk-typescript/issues/294)) ([ef35095](https://github.com/anthropics/anthropic-sdk-typescript/commit/ef350957bfc8982eac780cfb5dfac693cd35e80b))
* **internal:** refactor scripts ([#404](https://github.com/anthropics/anthropic-sdk-typescript/issues/404)) ([60d1d00](https://github.com/anthropics/anthropic-sdk-typescript/commit/60d1d0035cb066a244f36f384f9d2f828d7c8de6))
* **internal:** reformat pacakge.json ([#284](https://github.com/anthropics/anthropic-sdk-typescript/issues/284)) ([ebd573c](https://github.com/anthropics/anthropic-sdk-typescript/commit/ebd573c095b68abf7eb5e28a830a6a7eabe1b188))
* **internal:** remove old reference to check-test-server ([e31a467](https://github.com/anthropics/anthropic-sdk-typescript/commit/e31a467163d801f1af1f25e967bdab226f5942ac))
* **internal:** remove unnecessary getRequestClient function ([#623](https://github.com/anthropics/anthropic-sdk-typescript/issues/623)) ([e1791a0](https://github.com/anthropics/anthropic-sdk-typescript/commit/e1791a07e024416fad3655feee352257e86ca371))
* **internal:** replace deprecated aws-sdk packages with [@smithy](https://github.com/smithy) ([#447](https://github.com/anthropics/anthropic-sdk-typescript/issues/447)) ([e21df2d](https://github.com/anthropics/anthropic-sdk-typescript/commit/e21df2df1ebb9edbbd60a5af2c1ec9c52a9bd28b))
* **internal:** run build script over sub-packages ([c4de255](https://github.com/anthropics/anthropic-sdk-typescript/commit/c4de255fa66e4c5b3fb8f463a362bda5da7380e9))
* **internal:** support pre-release versioning ([#270](https://github.com/anthropics/anthropic-sdk-typescript/issues/270)) ([0456d30](https://github.com/anthropics/anthropic-sdk-typescript/commit/0456d3012cbe17377d3bf843c4bfa9540805b7cc))
* **internal:** temporary revert commit ([#643](https://github.com/anthropics/anthropic-sdk-typescript/issues/643)) ([5e992e1](https://github.com/anthropics/anthropic-sdk-typescript/commit/5e992e1a9f75eceb948242498b6818d9af89a60e))
* **internal:** update deps ([#296](https://github.com/anthropics/anthropic-sdk-typescript/issues/296)) ([5b58da3](https://github.com/anthropics/anthropic-sdk-typescript/commit/5b58da385c005956d68df6e1e7f823d428731b16))
* **internal:** update examples ([#649](https://github.com/anthropics/anthropic-sdk-typescript/issues/649)) ([106ddfd](https://github.com/anthropics/anthropic-sdk-typescript/commit/106ddfdf91989b044bcc4b18d7d3f0f0ef75ecac))
* **internal:** update generated pragma comment ([#341](https://github.com/anthropics/anthropic-sdk-typescript/issues/341)) ([9d562f3](https://github.com/anthropics/anthropic-sdk-typescript/commit/9d562f33f75d6cd2bc1056ef64b9d723aeb66912))
* **internal:** update gitignore ([#388](https://github.com/anthropics/anthropic-sdk-typescript/issues/388)) ([5d5cc50](https://github.com/anthropics/anthropic-sdk-typescript/commit/5d5cc504ba8f0da67146bf79634a281445e67da0))
* **internal:** update isAbsoluteURL ([#627](https://github.com/anthropics/anthropic-sdk-typescript/issues/627)) ([43f6929](https://github.com/anthropics/anthropic-sdk-typescript/commit/43f6929f1fbeb145823ecceb94a1cad221810bb5))
* **internal:** update lock files ([#377](https://github.com/anthropics/anthropic-sdk-typescript/issues/377)) ([0029ce4](https://github.com/anthropics/anthropic-sdk-typescript/commit/0029ce4c4516e22a970d67d211d37e95519b2786))
* **internal:** update publish npm script ([#483](https://github.com/anthropics/anthropic-sdk-typescript/issues/483)) ([404690c](https://github.com/anthropics/anthropic-sdk-typescript/commit/404690c80f7032b9d49bde1efd53a897d1d19580))
* **internal:** update release-please config ([#269](https://github.com/anthropics/anthropic-sdk-typescript/issues/269)) ([74719fc](https://github.com/anthropics/anthropic-sdk-typescript/commit/74719fc4321aadd7c4622458623073cd3adad8e8))
* **internal:** update resource client type ([#263](https://github.com/anthropics/anthropic-sdk-typescript/issues/263)) ([9876f1e](https://github.com/anthropics/anthropic-sdk-typescript/commit/9876f1e25c19c8171fd1da09b5c7ac7922e805bb))
* **internal:** update spec ([#566](https://github.com/anthropics/anthropic-sdk-typescript/issues/566)) ([36fb9c1](https://github.com/anthropics/anthropic-sdk-typescript/commit/36fb9c194a4189bd42ef299f0a8f587989650608))
* **internal:** update spec ([#630](https://github.com/anthropics/anthropic-sdk-typescript/issues/630)) ([327b611](https://github.com/anthropics/anthropic-sdk-typescript/commit/327b611ef16c516f4ac487a87995f0a5cad2e078))
* **internal:** update spec URL ([#554](https://github.com/anthropics/anthropic-sdk-typescript/issues/554)) ([93d24c0](https://github.com/anthropics/anthropic-sdk-typescript/commit/93d24c098162f009dedcb4173755b8d7d4b8f948))
* **internal:** update spec version ([#571](https://github.com/anthropics/anthropic-sdk-typescript/issues/571)) ([ac5d51b](https://github.com/anthropics/anthropic-sdk-typescript/commit/ac5d51b7ebfff00260d63d6a587fa759537376e9))
* **internal:** updates ([#487](https://github.com/anthropics/anthropic-sdk-typescript/issues/487)) ([0d72653](https://github.com/anthropics/anthropic-sdk-typescript/commit/0d726537c7c66d9954ee5b6fbd26503ab8dc2e19))
* **internal:** use @swc/jest for running tests ([#397](https://github.com/anthropics/anthropic-sdk-typescript/issues/397)) ([b73b64e](https://github.com/anthropics/anthropic-sdk-typescript/commit/b73b64e15540b3db53de310797cfd8d25c5e3911))
* **internal:** use actions/checkout@v4 for codeflow ([#400](https://github.com/anthropics/anthropic-sdk-typescript/issues/400)) ([50e5e85](https://github.com/anthropics/anthropic-sdk-typescript/commit/50e5e8591907be39fb9420f7d132da8fd24c9b64))
* **internal:** use reexports not destructuring ([#604](https://github.com/anthropics/anthropic-sdk-typescript/issues/604)) ([9f2d9b1](https://github.com/anthropics/anthropic-sdk-typescript/commit/9f2d9b12bed606650520c0609215716981b8ca9a))
* **package:** fix formatting ([#283](https://github.com/anthropics/anthropic-sdk-typescript/issues/283)) ([8030ed3](https://github.com/anthropics/anthropic-sdk-typescript/commit/8030ed3e2734c8e059aa9b988f374cfab87559d1))
* remove redundant word in comment ([#615](https://github.com/anthropics/anthropic-sdk-typescript/issues/615)) ([ff0a318](https://github.com/anthropics/anthropic-sdk-typescript/commit/ff0a318e2a163afed387f80658476a44a7a3977a))
* remove unused build-deno condition ([#585](https://github.com/anthropics/anthropic-sdk-typescript/issues/585)) ([461e300](https://github.com/anthropics/anthropic-sdk-typescript/commit/461e300db3c1317a9c09062cafaebbdcd4345c9f))
* respect `application/vnd.api+json` content-type header ([#286](https://github.com/anthropics/anthropic-sdk-typescript/issues/286)) ([cd2d75b](https://github.com/anthropics/anthropic-sdk-typescript/commit/cd2d75bd02b84321184f0ba9f6da98b726d37eec))
* run tsc as part of lint script ([#513](https://github.com/anthropics/anthropic-sdk-typescript/issues/513)) ([ffe75f4](https://github.com/anthropics/anthropic-sdk-typescript/commit/ffe75f4b4395d4ab17d1a21fe94b925fefb8f5ae))
* sync openapi version ([#481](https://github.com/anthropics/anthropic-sdk-typescript/issues/481)) ([cc9e04d](https://github.com/anthropics/anthropic-sdk-typescript/commit/cc9e04d6a24dd798922ff7d97ece006de83d7d2c))
* sync openapi version ([#485](https://github.com/anthropics/anthropic-sdk-typescript/issues/485)) ([159011f](https://github.com/anthropics/anthropic-sdk-typescript/commit/159011fb4a596cd8fb3c331ae97a6d95d104782f))
* sync openapi version ([#486](https://github.com/anthropics/anthropic-sdk-typescript/issues/486)) ([59a1288](https://github.com/anthropics/anthropic-sdk-typescript/commit/59a1288ad361baf67ffe626563df57e2f6cac9e8))
* sync spec ([#470](https://github.com/anthropics/anthropic-sdk-typescript/issues/470)) ([5720534](https://github.com/anthropics/anthropic-sdk-typescript/commit/5720534c066d16cf0437e28d2e008528ce5a4bbd))
* **tests:** add unit tests for partial-json-parser ([a96f91c](https://github.com/anthropics/anthropic-sdk-typescript/commit/a96f91cdb955cbb1ca37bc159e1b6dba1d068857))
* **tests:** limit array example length ([#611](https://github.com/anthropics/anthropic-sdk-typescript/issues/611)) ([b0cd4a9](https://github.com/anthropics/anthropic-sdk-typescript/commit/b0cd4a9b15ad16718775c6f8a2ea706886dcff28))
* **tests:** update prism version ([#473](https://github.com/anthropics/anthropic-sdk-typescript/issues/473)) ([869e9f0](https://github.com/anthropics/anthropic-sdk-typescript/commit/869e9f043cfd320bc15133feab431cbe608e0a56))
* **types:** add `| undefined` to client options properties ([#656](https://github.com/anthropics/anthropic-sdk-typescript/issues/656)) ([9de3762](https://github.com/anthropics/anthropic-sdk-typescript/commit/9de37623907d99107e87e437e6094e545733df92))
* **types:** consistent naming for text block types ([#373](https://github.com/anthropics/anthropic-sdk-typescript/issues/373)) ([b1b743f](https://github.com/anthropics/anthropic-sdk-typescript/commit/b1b743f4e633b0974b956530ccf5244227af5178))
* **types:** fix accidental exposure of Buffer type to cloudflare ([#319](https://github.com/anthropics/anthropic-sdk-typescript/issues/319)) ([a5e8d6d](https://github.com/anthropics/anthropic-sdk-typescript/commit/a5e8d6d04cb9c8224eccd5e0e211370223cd18b1))
* **types:** nicer error class types + jsdocs ([#626](https://github.com/anthropics/anthropic-sdk-typescript/issues/626)) ([b07be1d](https://github.com/anthropics/anthropic-sdk-typescript/commit/b07be1d05b0905a26980bc4401ee29f93b6390db))
* update examples ([459956a](https://github.com/anthropics/anthropic-sdk-typescript/commit/459956ac44b5a2fd1dd0d0828e0281875b5900e9))


### Documentation

* add a CONTRIBUTING.md ([#280](https://github.com/anthropics/anthropic-sdk-typescript/issues/280)) ([eb48958](https://github.com/anthropics/anthropic-sdk-typescript/commit/eb48958298ccac4da6e5a9a875d4196fe471412b))
* **bedrock:** fix dead link ([#356](https://github.com/anthropics/anthropic-sdk-typescript/issues/356)) ([131ba63](https://github.com/anthropics/anthropic-sdk-typescript/commit/131ba632f2a29e51842430cbdaae65b2002a7926))
* **contributing:** improve wording ([#299](https://github.com/anthropics/anthropic-sdk-typescript/issues/299)) ([623e4f6](https://github.com/anthropics/anthropic-sdk-typescript/commit/623e4f615541650ed08f1bdeb21c90b2ec23891e))
* deprecate old access token getter ([#322](https://github.com/anthropics/anthropic-sdk-typescript/issues/322)) ([25aa977](https://github.com/anthropics/anthropic-sdk-typescript/commit/25aa977c83820babbaf18a7061b8a55fbbfe69c3))
* fix missing async in readme code sample ([#255](https://github.com/anthropics/anthropic-sdk-typescript/issues/255)) ([6713fd7](https://github.com/anthropics/anthropic-sdk-typescript/commit/6713fd7b09836bceb05c05d75e43d59eee965163))
* fix typo in CONTRIBUTING.md ([#340](https://github.com/anthropics/anthropic-sdk-typescript/issues/340)) ([5ce4159](https://github.com/anthropics/anthropic-sdk-typescript/commit/5ce41591dd1f96ad071ff9ea2ed675f89b68bef2))
* **helpers:** mention inputJson event ([e991c62](https://github.com/anthropics/anthropic-sdk-typescript/commit/e991c62750c9d85c3902bb9889bf3f8aea6cd036))
* improve and reference contributing documentation ([#539](https://github.com/anthropics/anthropic-sdk-typescript/issues/539)) ([556d460](https://github.com/anthropics/anthropic-sdk-typescript/commit/556d460606c2efebcf2d75c1a41841d2711b5631))
* minor formatting changes ([#641](https://github.com/anthropics/anthropic-sdk-typescript/issues/641)) ([449b203](https://github.com/anthropics/anthropic-sdk-typescript/commit/449b203b0bbddcf9218d9b76379c9c9830393104))
* **readme:** add alpha callout ([#646](https://github.com/anthropics/anthropic-sdk-typescript/issues/646)) ([d1fc383](https://github.com/anthropics/anthropic-sdk-typescript/commit/d1fc383a285a832dccf6d84d78b044d57003b112))
* **readme:** add bundle size badge ([#426](https://github.com/anthropics/anthropic-sdk-typescript/issues/426)) ([d2b6aef](https://github.com/anthropics/anthropic-sdk-typescript/commit/d2b6aef52142cb917e0ea146a1a6e2aefc0b4d7e))
* **readme:** change undocumented params wording ([#363](https://github.com/anthropics/anthropic-sdk-typescript/issues/363)) ([3cd5957](https://github.com/anthropics/anthropic-sdk-typescript/commit/3cd5957e98f5eb95e2cd23585790f4be75b9f1aa))
* **readme:** consistent use of sentence case in headings ([#347](https://github.com/anthropics/anthropic-sdk-typescript/issues/347)) ([9aaaa76](https://github.com/anthropics/anthropic-sdk-typescript/commit/9aaaa76a41b759b24542ee7695072926cb522b0e))
* **readme:** document how to make undocumented requests ([#349](https://github.com/anthropics/anthropic-sdk-typescript/issues/349)) ([95647ce](https://github.com/anthropics/anthropic-sdk-typescript/commit/95647cea215f374bb473be94255591b64bfde991))
* **readme:** fix header for streaming helpers ([#293](https://github.com/anthropics/anthropic-sdk-typescript/issues/293)) ([a3a0c57](https://github.com/anthropics/anthropic-sdk-typescript/commit/a3a0c5703edc093786e8144ada28925191df35c5))
* **readme:** fix https proxy example ([#310](https://github.com/anthropics/anthropic-sdk-typescript/issues/310)) ([165f1d8](https://github.com/anthropics/anthropic-sdk-typescript/commit/165f1d8c6e3fdff0c165f4341e1fc7527b4fb310))
* **readme:** fix https proxy example ([#311](https://github.com/anthropics/anthropic-sdk-typescript/issues/311)) ([2161c86](https://github.com/anthropics/anthropic-sdk-typescript/commit/2161c86e20b1da1d9c2ec33cc60da6e743e9ee9f))
* **readme:** fix misplaced period ([#650](https://github.com/anthropics/anthropic-sdk-typescript/issues/650)) ([32ea63f](https://github.com/anthropics/anthropic-sdk-typescript/commit/32ea63f070436adac9e124b848615b3dfb789c7f))
* **readme:** fix Request IDs example ([#659](https://github.com/anthropics/anthropic-sdk-typescript/issues/659)) ([7a68f81](https://github.com/anthropics/anthropic-sdk-typescript/commit/7a68f81148040b9defa52fe1dc88d2ffeafd791e))
* **readme:** fix typo in custom fetch implementation ([#300](https://github.com/anthropics/anthropic-sdk-typescript/issues/300)) ([d55c320](https://github.com/anthropics/anthropic-sdk-typescript/commit/d55c320ce8684d7ffde6194b76232703806c6b3a))
* **readme:** improve api reference ([#254](https://github.com/anthropics/anthropic-sdk-typescript/issues/254)) ([618b85b](https://github.com/anthropics/anthropic-sdk-typescript/commit/618b85b1a43ecd4b89671880a45ee7868cee101a))
* **readme:** mention tool use ([#375](https://github.com/anthropics/anthropic-sdk-typescript/issues/375)) ([c08bdd4](https://github.com/anthropics/anthropic-sdk-typescript/commit/c08bdd4b91078ef9d18191771fbd300edb599fe7))
* **readme:** minor typo fixes ([#577](https://github.com/anthropics/anthropic-sdk-typescript/issues/577)) ([a143beb](https://github.com/anthropics/anthropic-sdk-typescript/commit/a143beb2b4f6204b573511bae88d1ecae4526593))
* **readme:** reference bedrock sdk ([#309](https://github.com/anthropics/anthropic-sdk-typescript/issues/309)) ([c94dea7](https://github.com/anthropics/anthropic-sdk-typescript/commit/c94dea791588ca1f2da4053f25f37f8984d2e47c))
* **readme:** update formatting and clarity for CORS flag ([54421d7](https://github.com/anthropics/anthropic-sdk-typescript/commit/54421d79ab87a818a77a49903bc4249f5b422b4e))
* remove extraneous --save and yarn install instructions ([#323](https://github.com/anthropics/anthropic-sdk-typescript/issues/323)) ([57f8656](https://github.com/anthropics/anthropic-sdk-typescript/commit/57f8656d9b61c334e2f1ac7ff7cce118bc4bf46d))
* remove suggestion to use `npm` call out ([#614](https://github.com/anthropics/anthropic-sdk-typescript/issues/614)) ([5349c08](https://github.com/anthropics/anthropic-sdk-typescript/commit/5349c08e0fe1935cf343833124a59f44932a1df0))
* update CONTRIBUTING.md ([#528](https://github.com/anthropics/anthropic-sdk-typescript/issues/528)) ([b2f7f82](https://github.com/anthropics/anthropic-sdk-typescript/commit/b2f7f82e2d1150605a5abb50a8521f7339149d2f))
* update models in vertex examples ([#331](https://github.com/anthropics/anthropic-sdk-typescript/issues/331)) ([0e1b5c0](https://github.com/anthropics/anthropic-sdk-typescript/commit/0e1b5c0f79f02dd12a69778609b0857bd47dadcd))
* use latest sonnet in example snippets ([#625](https://github.com/anthropics/anthropic-sdk-typescript/issues/625)) ([a965791](https://github.com/anthropics/anthropic-sdk-typescript/commit/a9657918aaf1246609105cbafaf4bb043b146356))


### Refactors

* **api:** mark completions API as legacy ([#291](https://github.com/anthropics/anthropic-sdk-typescript/issues/291)) ([eb210e2](https://github.com/anthropics/anthropic-sdk-typescript/commit/eb210e23b7b21951706c92a3536ba2de3b4c0b00))
* enable isolatedModules and change imports ([#573](https://github.com/anthropics/anthropic-sdk-typescript/issues/573)) ([20864db](https://github.com/anthropics/anthropic-sdk-typescript/commit/20864db22ece0b4d3d50a08b5037f7b3b1b4ffb5))
* extract model out to a named type and rename partialjson ([#477](https://github.com/anthropics/anthropic-sdk-typescript/issues/477)) ([e64cd50](https://github.com/anthropics/anthropic-sdk-typescript/commit/e64cd505d3d645144c3e9ff79cc4086f1f6ddf8e))
* **types:** improve metadata types ([#546](https://github.com/anthropics/anthropic-sdk-typescript/issues/546)) ([d1be006](https://github.com/anthropics/anthropic-sdk-typescript/commit/d1be0067c63118916f9d026596139d779dd0b2ff))
* **types:** improve tool type names ([#543](https://github.com/anthropics/anthropic-sdk-typescript/issues/543)) ([0c26a5b](https://github.com/anthropics/anthropic-sdk-typescript/commit/0c26a5b1197c9661ea902dfaa4353976b8d73e15))
* **types:** improve tool type names ([#544](https://github.com/anthropics/anthropic-sdk-typescript/issues/544)) ([e21e129](https://github.com/anthropics/anthropic-sdk-typescript/commit/e21e129db71dba474e2277be966a22b2d25afc8d))
* use type imports for type-only imports ([#580](https://github.com/anthropics/anthropic-sdk-typescript/issues/580)) ([029e485](https://github.com/anthropics/anthropic-sdk-typescript/commit/029e485d74f09582484de149825b93f46096878e))


### Build System

* configure UTF-8 locale in devcontainer ([#393](https://github.com/anthropics/anthropic-sdk-typescript/issues/393)) ([6aeb955](https://github.com/anthropics/anthropic-sdk-typescript/commit/6aeb955cd6bbd553ec0d9ae703f0c199c5470ac8))

## 0.35.0 (2025-01-21)

Full Changelog: [sdk-v0.34.0...sdk-v0.35.0](https://github.com/anthropics/anthropic-sdk-typescript/compare/sdk-v0.34.0...sdk-v0.35.0)

### Features

* add beta message streaming helpers ([#655](https://github.com/anthropics/anthropic-sdk-typescript/issues/655)) ([d7b5af1](https://github.com/anthropics/anthropic-sdk-typescript/commit/d7b5af1629dbcefdb7bfdca271ab497567830227))
* **stream:** add `.withResponse()` ([#654](https://github.com/anthropics/anthropic-sdk-typescript/issues/654)) ([b54477f](https://github.com/anthropics/anthropic-sdk-typescript/commit/b54477f20c92db4c2c5ed89af5d46c36b035bf1e))
* **streaming:** add `.request_id` getter ([4572478](https://github.com/anthropics/anthropic-sdk-typescript/commit/4572478266a67e12e32ffef69817cbc495943b1d))


### Bug Fixes

* **docs:** correct results return type ([#657](https://github.com/anthropics/anthropic-sdk-typescript/issues/657)) ([4e6d031](https://github.com/anthropics/anthropic-sdk-typescript/commit/4e6d031a41625ebf9c4311638e0c149179fcae0c))
* **examples:** add token counting example ([2498e2e](https://github.com/anthropics/anthropic-sdk-typescript/commit/2498e2eaf49d66a664ed1fdcd7bbd331979cf5b2))
* send correct Accept header for certain endpoints ([#651](https://github.com/anthropics/anthropic-sdk-typescript/issues/651)) ([17ffaeb](https://github.com/anthropics/anthropic-sdk-typescript/commit/17ffaeba5af48d13b08483973b82cfe1ae79347f))
* **vertex:** add beta.messages.countTokens method ([51d3f23](https://github.com/anthropics/anthropic-sdk-typescript/commit/51d3f23a7cc1bea798cc8e4041e08114ebc3a4eb))


### Chores

* deprecate more models ([661f5f9](https://github.com/anthropics/anthropic-sdk-typescript/commit/661f5f9d9b24f3661df246dcf101dd9812b3e19e))
* **internal:** add test ([#660](https://github.com/anthropics/anthropic-sdk-typescript/issues/660)) ([3ec7d1a](https://github.com/anthropics/anthropic-sdk-typescript/commit/3ec7d1a9eea30255b24cdb16c1a26705bdfea0ac))
* **internal:** temporary revert commit ([#643](https://github.com/anthropics/anthropic-sdk-typescript/issues/643)) ([43dd43c](https://github.com/anthropics/anthropic-sdk-typescript/commit/43dd43c4c8ab69d5a60e59473af7dff5f7799048))
* **internal:** update examples ([#649](https://github.com/anthropics/anthropic-sdk-typescript/issues/649)) ([036a239](https://github.com/anthropics/anthropic-sdk-typescript/commit/036a239800fec7e6cbc439f125101d5475eae5b3))
* **types:** add `| undefined` to client options properties ([#656](https://github.com/anthropics/anthropic-sdk-typescript/issues/656)) ([d642298](https://github.com/anthropics/anthropic-sdk-typescript/commit/d642298334529ff95b9d7ac497d548a6b04dbcfb))


### Documentation

* **readme:** fix misplaced period ([#650](https://github.com/anthropics/anthropic-sdk-typescript/issues/650)) ([8754744](https://github.com/anthropics/anthropic-sdk-typescript/commit/87547448c8b4bf69a61756af1f12927f33b68680))
* **readme:** fix Request IDs example ([#659](https://github.com/anthropics/anthropic-sdk-typescript/issues/659)) ([6d3162d](https://github.com/anthropics/anthropic-sdk-typescript/commit/6d3162da1ddb964b75e575376f278468ba1ed9f5))

## 0.34.0 (2024-12-20)

Full Changelog: [sdk-v0.33.1...sdk-v0.34.0](https://github.com/anthropics/anthropic-sdk-typescript/compare/sdk-v0.33.1...sdk-v0.34.0)

### Features

* **api:** add message batch delete endpoint ([#640](https://github.com/anthropics/anthropic-sdk-typescript/issues/640)) ([54f7e1f](https://github.com/anthropics/anthropic-sdk-typescript/commit/54f7e1ffb9a2956ee27a4a715b84717aa681eb7c))


### Bug Fixes

* **client:** normalize method ([#639](https://github.com/anthropics/anthropic-sdk-typescript/issues/639)) ([384bb04](https://github.com/anthropics/anthropic-sdk-typescript/commit/384bb042dd854ed753c6bd8e25f522d0e042bfbf))


### Chores

* bump testing data uri ([#637](https://github.com/anthropics/anthropic-sdk-typescript/issues/637)) ([3f23530](https://github.com/anthropics/anthropic-sdk-typescript/commit/3f23530fb55d9fec7278967ea02600e44e9f58e2))
* **internal:** temporary revert commit ([#643](https://github.com/anthropics/anthropic-sdk-typescript/issues/643)) ([8057b1e](https://github.com/anthropics/anthropic-sdk-typescript/commit/8057b1eb67ccccee042a45f2efe53cccced15682))


### Documentation

* minor formatting changes ([#641](https://github.com/anthropics/anthropic-sdk-typescript/issues/641)) ([8b362ee](https://github.com/anthropics/anthropic-sdk-typescript/commit/8b362ee72954b31b4de920b35aed97255efa5e2e))
* **readme:** add alpha callout ([#646](https://github.com/anthropics/anthropic-sdk-typescript/issues/646)) ([640304c](https://github.com/anthropics/anthropic-sdk-typescript/commit/640304c7c7e8bc67cbf799a646169736d89ad4c8))

## 0.33.1 (2024-12-17)

Full Changelog: [sdk-v0.33.0...sdk-v0.33.1](https://github.com/anthropics/anthropic-sdk-typescript/compare/sdk-v0.33.0...sdk-v0.33.1)

### Bug Fixes

* **vertex:** remove `anthropic_version` deletion for token counting ([88221be](https://github.com/anthropics/anthropic-sdk-typescript/commit/88221be305d6e13ccf92e6e9cdb00daba45b57db))


### Chores

* **internal:** fix some typos ([#633](https://github.com/anthropics/anthropic-sdk-typescript/issues/633)) ([a0298f5](https://github.com/anthropics/anthropic-sdk-typescript/commit/a0298f5f67b8ecd25de416dbb3eada68b86befd7))

## 0.33.0 (2024-12-17)

Full Changelog: [sdk-v0.32.1...sdk-v0.33.0](https://github.com/anthropics/anthropic-sdk-typescript/compare/sdk-v0.32.1...sdk-v0.33.0)

### Features

* **api:** general availability updates ([93d1316](https://github.com/anthropics/anthropic-sdk-typescript/commit/93d13168f950b2cdfc3b7c6664205b06418fea79))
* **api:** general availability updates ([#631](https://github.com/anthropics/anthropic-sdk-typescript/issues/631)) ([b5c92e5](https://github.com/anthropics/anthropic-sdk-typescript/commit/b5c92e5b74c370ac3f9ba28e915bd54588a42be0))
* **client:** add ._request_id property to object responses ([#596](https://github.com/anthropics/anthropic-sdk-typescript/issues/596)) ([9d6d584](https://github.com/anthropics/anthropic-sdk-typescript/commit/9d6d58430a216df9888434158bf628ae4b067aba))
* **internal:** make git install file structure match npm ([#617](https://github.com/anthropics/anthropic-sdk-typescript/issues/617)) ([d3dd7d5](https://github.com/anthropics/anthropic-sdk-typescript/commit/d3dd7d5f8cad460dd18725d5c0f3c8db3f00115d))
* **vertex:** support token counting ([9e76b4d](https://github.com/anthropics/anthropic-sdk-typescript/commit/9e76b4dc22d62b1239b382bb771b69ad8cff9442))


### Bug Fixes

* **docs:** add missing await to pagination example ([#609](https://github.com/anthropics/anthropic-sdk-typescript/issues/609)) ([e303077](https://github.com/anthropics/anthropic-sdk-typescript/commit/e303077ebab73c41adee7d25375b767c3fc78998))
* **types:** remove anthropic-instant-1.2 model ([#599](https://github.com/anthropics/anthropic-sdk-typescript/issues/599)) ([e222a4d](https://github.com/anthropics/anthropic-sdk-typescript/commit/e222a4d0518aa80671c66ee2a25d87dc87a51316))


### Chores

* **api:** update spec version ([#607](https://github.com/anthropics/anthropic-sdk-typescript/issues/607)) ([ea44f9a](https://github.com/anthropics/anthropic-sdk-typescript/commit/ea44f9ac49dcc25a5dfa53880ebf61318ee90f6c))
* **api:** update spec version ([#629](https://github.com/anthropics/anthropic-sdk-typescript/issues/629)) ([a25295c](https://github.com/anthropics/anthropic-sdk-typescript/commit/a25295cd6db7b57162fdd9049eb8a3c37bb94f08))
* **bedrock,vertex:** remove unsupported countTokens method ([#597](https://github.com/anthropics/anthropic-sdk-typescript/issues/597)) ([17b7da5](https://github.com/anthropics/anthropic-sdk-typescript/commit/17b7da5ee6f35ea2bdd53a66a662871affae6341))
* **bedrock:** remove unsupported methods ([6458dc1](https://github.com/anthropics/anthropic-sdk-typescript/commit/6458dc14544c16240a6580a21a36fcf5bde594b2))
* **ci:** remove unneeded workflow ([#594](https://github.com/anthropics/anthropic-sdk-typescript/issues/594)) ([7572e48](https://github.com/anthropics/anthropic-sdk-typescript/commit/7572e48dbccb2090562399c7ff2d01503c86f445))
* **client:** drop unused devDependency ([#610](https://github.com/anthropics/anthropic-sdk-typescript/issues/610)) ([5d0d523](https://github.com/anthropics/anthropic-sdk-typescript/commit/5d0d523390d8c34cae836c423940b67defb9d2aa))
* improve browser error message ([#613](https://github.com/anthropics/anthropic-sdk-typescript/issues/613)) ([c26121e](https://github.com/anthropics/anthropic-sdk-typescript/commit/c26121e84039b7430995b6363876ea9795ba31ed))
* **internal:** bump cross-spawn to v7.0.6 ([#624](https://github.com/anthropics/anthropic-sdk-typescript/issues/624)) ([e58ba9a](https://github.com/anthropics/anthropic-sdk-typescript/commit/e58ba9a177ec5c8545fd3a3f4fd3d2e7c722f023))
* **internal:** remove unnecessary getRequestClient function ([#623](https://github.com/anthropics/anthropic-sdk-typescript/issues/623)) ([882c45f](https://github.com/anthropics/anthropic-sdk-typescript/commit/882c45f5a0bd1f4b996d59e6589a205c2111f46b))
* **internal:** update isAbsoluteURL ([#627](https://github.com/anthropics/anthropic-sdk-typescript/issues/627)) ([2528ea0](https://github.com/anthropics/anthropic-sdk-typescript/commit/2528ea0dcfc83f38e76b58eaadaa5e8c5c0b188d))
* **internal:** update spec ([#630](https://github.com/anthropics/anthropic-sdk-typescript/issues/630)) ([82cac06](https://github.com/anthropics/anthropic-sdk-typescript/commit/82cac065e2711467773c0ea62848cdf139ed5a11))
* **internal:** use reexports not destructuring ([#604](https://github.com/anthropics/anthropic-sdk-typescript/issues/604)) ([e4daff2](https://github.com/anthropics/anthropic-sdk-typescript/commit/e4daff2b6a3fb42876ebd06ed4947c88cff919d8))
* remove redundant word in comment ([#615](https://github.com/anthropics/anthropic-sdk-typescript/issues/615)) ([ef57a10](https://github.com/anthropics/anthropic-sdk-typescript/commit/ef57a103bcfc922a724a7c878f970dbd369b305e))
* **tests:** limit array example length ([#611](https://github.com/anthropics/anthropic-sdk-typescript/issues/611)) ([91dc181](https://github.com/anthropics/anthropic-sdk-typescript/commit/91dc1812db2cc9e1f4660a13106bad932518b7cf))
* **types:** nicer error class types + jsdocs ([#626](https://github.com/anthropics/anthropic-sdk-typescript/issues/626)) ([0287993](https://github.com/anthropics/anthropic-sdk-typescript/commit/0287993912ef81bd2c49603d120f49f4f979d75e))


### Documentation

* remove suggestion to use `npm` call out ([#614](https://github.com/anthropics/anthropic-sdk-typescript/issues/614)) ([6369261](https://github.com/anthropics/anthropic-sdk-typescript/commit/6369261e3597351f17b8f1a3945ca56b00eba177))
* use latest sonnet in example snippets ([#625](https://github.com/anthropics/anthropic-sdk-typescript/issues/625)) ([f70882b](https://github.com/anthropics/anthropic-sdk-typescript/commit/f70882b0e8119a414b01b9f0b85fbe1ccb06f122))

## 0.32.1 (2024-11-05)

Full Changelog: [sdk-v0.32.0...sdk-v0.32.1](https://github.com/anthropics/anthropic-sdk-typescript/compare/sdk-v0.32.0...sdk-v0.32.1)

### Bug Fixes

* **bedrock:** don't mutate request body inputs ([f83b535](https://github.com/anthropics/anthropic-sdk-typescript/commit/f83b53520262219229cecc388f95d92be83c09d5))
* **vertex:** don't mutate request body inputs ([e9a82e5](https://github.com/anthropics/anthropic-sdk-typescript/commit/e9a82e56f0d7fff956c2ebd19e103a190f8beb83))

## 0.32.0 (2024-11-04)

Full Changelog: [sdk-v0.31.0...sdk-v0.32.0](https://github.com/anthropics/anthropic-sdk-typescript/compare/sdk-v0.31.0...sdk-v0.32.0)

### Features

* **api:** add new haiku model ([#587](https://github.com/anthropics/anthropic-sdk-typescript/issues/587)) ([983b13c](https://github.com/anthropics/anthropic-sdk-typescript/commit/983b13c9e4f55b832fc4fddfd46bed89756d745e))


### Bug Fixes

* don't require deno to run build-deno ([#586](https://github.com/anthropics/anthropic-sdk-typescript/issues/586)) ([0e431d6](https://github.com/anthropics/anthropic-sdk-typescript/commit/0e431d61ec318aae09687dee0bfb922ccb8ddd15))
* **types:** add missing token-counting-2024-11-01 ([#583](https://github.com/anthropics/anthropic-sdk-typescript/issues/583)) ([13d629c](https://github.com/anthropics/anthropic-sdk-typescript/commit/13d629c9b444a32b69729df7792199556a2b95f2))


### Chores

* remove unused build-deno condition ([#585](https://github.com/anthropics/anthropic-sdk-typescript/issues/585)) ([491e8fe](https://github.com/anthropics/anthropic-sdk-typescript/commit/491e8fe28745aeb55217809f94ad4e37900f4675))

## 0.31.0 (2024-11-01)

Full Changelog: [sdk-v0.30.1...sdk-v0.31.0](https://github.com/anthropics/anthropic-sdk-typescript/compare/sdk-v0.30.1...sdk-v0.31.0)

### Features

* **api:** add message token counting & PDFs support ([#582](https://github.com/anthropics/anthropic-sdk-typescript/issues/582)) ([b593837](https://github.com/anthropics/anthropic-sdk-typescript/commit/b593837ae2d320414a26b5ec53aa6d3f30a3e6bc))


### Bug Fixes

* **countTokens:** correctly set beta header ([1680757](https://github.com/anthropics/anthropic-sdk-typescript/commit/16807572af923831e384869a0a6ccccaa8dbec84))
* **internal:** support pnpm git installs ([#579](https://github.com/anthropics/anthropic-sdk-typescript/issues/579)) ([86bb102](https://github.com/anthropics/anthropic-sdk-typescript/commit/86bb102ce33346930a8b0a553a909fcc7d964a36))
* **types:** add missing token-counting-2024-11-01 ([aff1546](https://github.com/anthropics/anthropic-sdk-typescript/commit/aff1546cd84ce50a52d17bcdcaba54e60e92955a))


### Reverts

* disable isolatedModules and change imports ([#575](https://github.com/anthropics/anthropic-sdk-typescript/issues/575)) ([2c3b176](https://github.com/anthropics/anthropic-sdk-typescript/commit/2c3b176fc551c21abef240b4fa6a98d33ca52048))


### Chores

* **internal:** update spec version ([#571](https://github.com/anthropics/anthropic-sdk-typescript/issues/571)) ([5760012](https://github.com/anthropics/anthropic-sdk-typescript/commit/576001245f0b5222cb9b17fafb8619f68d51bec3))


### Documentation

* **readme:** minor typo fixes ([#577](https://github.com/anthropics/anthropic-sdk-typescript/issues/577)) ([8412854](https://github.com/anthropics/anthropic-sdk-typescript/commit/8412854c05837cdb8b8ff898bef2a4e0dbb23cd2))


### Refactors

* enable isolatedModules and change imports ([#573](https://github.com/anthropics/anthropic-sdk-typescript/issues/573)) ([9068b4b](https://github.com/anthropics/anthropic-sdk-typescript/commit/9068b4b0a0a08a69a9330ce03418135e11aa539e))
* use type imports for type-only imports ([#580](https://github.com/anthropics/anthropic-sdk-typescript/issues/580)) ([2c8a337](https://github.com/anthropics/anthropic-sdk-typescript/commit/2c8a337033e850b7282d35b37c3ce36d5b0dabbe))

## 0.30.1 (2024-10-23)

Full Changelog: [sdk-v0.30.0...sdk-v0.30.1](https://github.com/anthropics/anthropic-sdk-typescript/compare/sdk-v0.30.0...sdk-v0.30.1)

### Bug Fixes

* **bedrock:** correct messages beta handling ([9b57586](https://github.com/anthropics/anthropic-sdk-typescript/commit/9b57586456221f8900902b8e85c7c017959c150a))
* **vertex:** correct messages beta handling ([26f21ee](https://github.com/anthropics/anthropic-sdk-typescript/commit/26f21ee5f524f4cbfb7a97d40aa62553608b1d99))


### Chores

* **internal:** bumps eslint and related dependencies ([#570](https://github.com/anthropics/anthropic-sdk-typescript/issues/570)) ([0b3ebb0](https://github.com/anthropics/anthropic-sdk-typescript/commit/0b3ebb01c07356e09f0100c235200ca91384aa6a))

## 0.30.0 (2024-10-22)

Full Changelog: [sdk-v0.29.2...sdk-v0.30.0](https://github.com/anthropics/anthropic-sdk-typescript/compare/sdk-v0.29.2...sdk-v0.30.0)

### Features

* **api:** add new model and `computer-use-2024-10-22` beta ([6981d89](https://github.com/anthropics/anthropic-sdk-typescript/commit/6981d89d3efe6ae8d35c7562527a6c81ad8ed78f))
* **bedrock:** add beta.messages.create() method ([6317592](https://github.com/anthropics/anthropic-sdk-typescript/commit/63175920a016a2ad187dd1127d263357cf6c007e))
* **vertex:** add beta.messages.create() ([22cfdba](https://github.com/anthropics/anthropic-sdk-typescript/commit/22cfdba2a3a54e916f2efcbce62990544d3e5f5f))


### Bug Fixes

* **client:** respect x-stainless-retry-count default headers ([#562](https://github.com/anthropics/anthropic-sdk-typescript/issues/562)) ([274573f](https://github.com/anthropics/anthropic-sdk-typescript/commit/274573f5bc74e382302071850dee058ea2920f0c))


### Chores

* **api:** add title ([#564](https://github.com/anthropics/anthropic-sdk-typescript/issues/564)) ([a8b7544](https://github.com/anthropics/anthropic-sdk-typescript/commit/a8b7544e56d4a1dfa1f6de530ddaa728ae52c87f))
* **internal:** update spec ([#566](https://github.com/anthropics/anthropic-sdk-typescript/issues/566)) ([5b998ea](https://github.com/anthropics/anthropic-sdk-typescript/commit/5b998eaf3216fba2283e7762faa115bd5f47a239))

## 0.29.2 (2024-10-17)

Full Changelog: [sdk-v0.29.1...sdk-v0.29.2](https://github.com/anthropics/anthropic-sdk-typescript/compare/sdk-v0.29.1...sdk-v0.29.2)

### Bug Fixes

* **types:** remove misleading betas TypedDict property for the Batch API ([#559](https://github.com/anthropics/anthropic-sdk-typescript/issues/559)) ([4de5d0a](https://github.com/anthropics/anthropic-sdk-typescript/commit/4de5d0a9d0a8733987d13dcef968146620d3b110))

## 0.29.1 (2024-10-15)

Full Changelog: [sdk-v0.29.0...sdk-v0.29.1](https://github.com/anthropics/anthropic-sdk-typescript/compare/sdk-v0.29.0...sdk-v0.29.1)

### Bug Fixes

* **beta:** merge betas param with the default value ([#556](https://github.com/anthropics/anthropic-sdk-typescript/issues/556)) ([5520bbc](https://github.com/anthropics/anthropic-sdk-typescript/commit/5520bbccaa75fbab5aa321402637c77651ae3c87))


### Chores

* **internal:** update spec URL ([#554](https://github.com/anthropics/anthropic-sdk-typescript/issues/554)) ([1fb6448](https://github.com/anthropics/anthropic-sdk-typescript/commit/1fb64489aa1b13c266692c7d14d2dd9b5350b7fc))

## 0.29.0 (2024-10-08)

Full Changelog: [sdk-v0.28.0...sdk-v0.29.0](https://github.com/anthropics/anthropic-sdk-typescript/compare/sdk-v0.28.0...sdk-v0.29.0)

### Features

* **api:** add message batches api ([4f114d5](https://github.com/anthropics/anthropic-sdk-typescript/commit/4f114d5121f5c66619c7bdd18d0aa2b7a627e3ff))


### Chores

* **internal:** move LineDecoder to a separate file ([#541](https://github.com/anthropics/anthropic-sdk-typescript/issues/541)) ([fd42469](https://github.com/anthropics/anthropic-sdk-typescript/commit/fd4246928d11347147955ca19efcd4c5b0accb10))
* **internal:** pass props through internal parser ([#549](https://github.com/anthropics/anthropic-sdk-typescript/issues/549)) ([dd71955](https://github.com/anthropics/anthropic-sdk-typescript/commit/dd7195501e0419ca1e6bafd7341b0726e8b809ab))


### Refactors

* **types:** improve metadata type names ([#547](https://github.com/anthropics/anthropic-sdk-typescript/issues/547)) ([cef499c](https://github.com/anthropics/anthropic-sdk-typescript/commit/cef499cf3b01643f7e5e3c09524f49e198b940be))
* **types:** improve metadata types ([#546](https://github.com/anthropics/anthropic-sdk-typescript/issues/546)) ([3fe538b](https://github.com/anthropics/anthropic-sdk-typescript/commit/3fe538bb8cd50e6d68cacc0846f287dc539238d3))
* **types:** improve tool type names ([#543](https://github.com/anthropics/anthropic-sdk-typescript/issues/543)) ([18dbe77](https://github.com/anthropics/anthropic-sdk-typescript/commit/18dbe7773781eb3917c9609bf490b515d75e6841))
* **types:** improve tool type names ([#544](https://github.com/anthropics/anthropic-sdk-typescript/issues/544)) ([fc2d823](https://github.com/anthropics/anthropic-sdk-typescript/commit/fc2d8230c6fb68e247743ffa82c3ba9f8b989adf))

## 0.28.0 (2024-10-04)

Full Changelog: [sdk-v0.27.3...sdk-v0.28.0](https://github.com/anthropics/anthropic-sdk-typescript/compare/sdk-v0.27.3...sdk-v0.28.0)

### Features

* **api:** support disabling parallel tool use ([#540](https://github.com/anthropics/anthropic-sdk-typescript/issues/540)) ([df0032f](https://github.com/anthropics/anthropic-sdk-typescript/commit/df0032f263884190b31a63ddcb20429372617deb))
* **client:** allow overriding retry count header ([#536](https://github.com/anthropics/anthropic-sdk-typescript/issues/536)) ([ec11f91](https://github.com/anthropics/anthropic-sdk-typescript/commit/ec11f9189e9a24f413a9d48b21a10ce88e367ac3))
* **client:** send retry count header ([#533](https://github.com/anthropics/anthropic-sdk-typescript/issues/533)) ([401b81c](https://github.com/anthropics/anthropic-sdk-typescript/commit/401b81c55c1f998dc917fc268884c162f214df20))


### Bug Fixes

* **types:** remove leftover polyfill usage ([#532](https://github.com/anthropics/anthropic-sdk-typescript/issues/532)) ([ac188b2](https://github.com/anthropics/anthropic-sdk-typescript/commit/ac188b29670d409c15e740bca26f8ef488cb7d05))


### Chores

* better object fallback behaviour for casting errors ([#503](https://github.com/anthropics/anthropic-sdk-typescript/issues/503)) ([3660e97](https://github.com/anthropics/anthropic-sdk-typescript/commit/3660e977e7127b10446b24b0a76b0133b3f666de))
* better object fallback behaviour for casting errors ([#526](https://github.com/anthropics/anthropic-sdk-typescript/issues/526)) ([4ffb2e4](https://github.com/anthropics/anthropic-sdk-typescript/commit/4ffb2e4e1f5fef3ae58d9f4c99a63e75dd459c5b))
* **internal:** add dev dependency ([#531](https://github.com/anthropics/anthropic-sdk-typescript/issues/531)) ([a9c127b](https://github.com/anthropics/anthropic-sdk-typescript/commit/a9c127b2854d0cf7efd49e7d46ff10fe52372949))


### Documentation

* improve and reference contributing documentation ([#539](https://github.com/anthropics/anthropic-sdk-typescript/issues/539)) ([cbef925](https://github.com/anthropics/anthropic-sdk-typescript/commit/cbef925519c63f09626ea7aa61ab8ba9d36bc35d))
* update CONTRIBUTING.md ([#528](https://github.com/anthropics/anthropic-sdk-typescript/issues/528)) ([2609dec](https://github.com/anthropics/anthropic-sdk-typescript/commit/2609dec770d33b828c957e431f2d03871e67e629))

## 0.27.3 (2024-09-09)

Full Changelog: [sdk-v0.27.2...sdk-v0.27.3](https://github.com/anthropics/anthropic-sdk-typescript/compare/sdk-v0.27.2...sdk-v0.27.3)

### Bug Fixes

* **streaming:** correct error message serialisation ([#524](https://github.com/anthropics/anthropic-sdk-typescript/issues/524)) ([e150fa4](https://github.com/anthropics/anthropic-sdk-typescript/commit/e150fa47d0cd4cbbe1269e3971085d4a434fc3ba))
* **uploads:** avoid making redundant memory copies ([#520](https://github.com/anthropics/anthropic-sdk-typescript/issues/520)) ([b6d2638](https://github.com/anthropics/anthropic-sdk-typescript/commit/b6d2638387612def84cebac2dedd5fbbea776d09))


### Chores

* **docs:** update browser support information ([#522](https://github.com/anthropics/anthropic-sdk-typescript/issues/522)) ([ce7aeb5](https://github.com/anthropics/anthropic-sdk-typescript/commit/ce7aeb59ccba4e4d19cb9aa88d7055fb585865ae))

## 0.27.2 (2024-09-04)

Full Changelog: [sdk-v0.27.1...sdk-v0.27.2](https://github.com/anthropics/anthropic-sdk-typescript/compare/sdk-v0.27.1...sdk-v0.27.2)

### Bug Fixes

* **client:** correct File construction from node-fetch Responses ([#518](https://github.com/anthropics/anthropic-sdk-typescript/issues/518)) ([62ae46f](https://github.com/anthropics/anthropic-sdk-typescript/commit/62ae46fb1e1b360850aafc9e935411c9b7d1c3bb))


### Chores

* **api:** deprecate claude-1 models ([53644d2](https://github.com/anthropics/anthropic-sdk-typescript/commit/53644d2690e62623afc04383cad0126f98ea37e8))
* **ci:** install deps via ./script/bootstrap ([#515](https://github.com/anthropics/anthropic-sdk-typescript/issues/515)) ([90a8da1](https://github.com/anthropics/anthropic-sdk-typescript/commit/90a8da1dc937e9aea9fdf6862c3ddb414b39963a))
* **internal:** dependency updates ([#519](https://github.com/anthropics/anthropic-sdk-typescript/issues/519)) ([b7b0cd6](https://github.com/anthropics/anthropic-sdk-typescript/commit/b7b0cd6579cd987662e7118f8563f68c0903f8da))
* run tsc as part of lint script ([#513](https://github.com/anthropics/anthropic-sdk-typescript/issues/513)) ([c8127cf](https://github.com/anthropics/anthropic-sdk-typescript/commit/c8127cfa3bdd1370934fe122018e20fc659a4dbb))

## 0.27.1 (2024-08-27)

Full Changelog: [sdk-v0.27.0...sdk-v0.27.1](https://github.com/anthropics/anthropic-sdk-typescript/compare/sdk-v0.27.0...sdk-v0.27.1)

### Chores

* **ci:** check for build errors ([#511](https://github.com/anthropics/anthropic-sdk-typescript/issues/511)) ([3ab1d3d](https://github.com/anthropics/anthropic-sdk-typescript/commit/3ab1d3d936f5ba3500f2ce87012c38bd198c3cbd))

## 0.27.0 (2024-08-21)

Full Changelog: [sdk-v0.26.1...sdk-v0.27.0](https://github.com/anthropics/anthropic-sdk-typescript/compare/sdk-v0.26.1...sdk-v0.27.0)

### Features

* **client:** add support for browser usage ([#504](https://github.com/anthropics/anthropic-sdk-typescript/issues/504)) ([93c5f16](https://github.com/anthropics/anthropic-sdk-typescript/commit/93c5f16b4b8c3404bd67d6eb5a0556a8b0a5d027))


### Documentation

* **readme:** update formatting and clarity for CORS flag ([9cb2c35](https://github.com/anthropics/anthropic-sdk-typescript/commit/9cb2c35f92827eb8654b1669db5ba702770fcae4))

## 0.26.1 (2024-08-15)

Full Changelog: [sdk-v0.26.0...sdk-v0.26.1](https://github.com/anthropics/anthropic-sdk-typescript/compare/sdk-v0.26.0...sdk-v0.26.1)

### Chores

* **ci:** add CODEOWNERS file ([#498](https://github.com/anthropics/anthropic-sdk-typescript/issues/498)) ([c34433f](https://github.com/anthropics/anthropic-sdk-typescript/commit/c34433fb6528fdd00d189ea0a3b177d95c7c7fa9))
* **docs/api:** update prompt caching helpers ([04195a3](https://github.com/anthropics/anthropic-sdk-typescript/commit/04195a345d62c98f826e5eecdad20f497db5b3e5))

## 0.26.0 (2024-08-14)

Full Changelog: [sdk-v0.25.2...sdk-v0.26.0](https://github.com/anthropics/anthropic-sdk-typescript/compare/sdk-v0.25.2...sdk-v0.26.0)

### Features

* **api:** add prompt caching beta ([c920b77](https://github.com/anthropics/anthropic-sdk-typescript/commit/c920b77fc67bd839bfeb6716ceab9d7c9bbe7393))
* **client:** add streaming helpers ([39abc26](https://github.com/anthropics/anthropic-sdk-typescript/commit/39abc2635517d564ac8b7e63235f0a338fc4bed0))


### Chores

* **examples:** minor formatting changes ([#491](https://github.com/anthropics/anthropic-sdk-typescript/issues/491)) ([8afef58](https://github.com/anthropics/anthropic-sdk-typescript/commit/8afef584895ffa3f8382c98d2c0a3fc6138e9420))

## 0.25.2 (2024-08-12)

Full Changelog: [sdk-v0.25.1...sdk-v0.25.2](https://github.com/anthropics/anthropic-sdk-typescript/compare/sdk-v0.25.1...sdk-v0.25.2)

### Chores

* **ci:** bump prism mock server version ([#490](https://github.com/anthropics/anthropic-sdk-typescript/issues/490)) ([bfb27f5](https://github.com/anthropics/anthropic-sdk-typescript/commit/bfb27f54c9b4ff4f9ae06327db454f72431b5bf4))
* **ci:** minor changes ([#488](https://github.com/anthropics/anthropic-sdk-typescript/issues/488)) ([747fd97](https://github.com/anthropics/anthropic-sdk-typescript/commit/747fd973af594cc52f244b33f31bcf8079733e7d))

## 0.25.1 (2024-08-09)

Full Changelog: [sdk-v0.25.0...sdk-v0.25.1](https://github.com/anthropics/anthropic-sdk-typescript/compare/sdk-v0.25.0...sdk-v0.25.1)

### Chores

* **internal:** update publish npm script ([#483](https://github.com/anthropics/anthropic-sdk-typescript/issues/483)) ([fb862ff](https://github.com/anthropics/anthropic-sdk-typescript/commit/fb862ff18be308ff710a2f97716f0ad1a62b9fbd))
* **internal:** updates ([#487](https://github.com/anthropics/anthropic-sdk-typescript/issues/487)) ([67a3325](https://github.com/anthropics/anthropic-sdk-typescript/commit/67a3325aa05c5a19f06b0cb1e67517168427c300))
* sync openapi version ([#481](https://github.com/anthropics/anthropic-sdk-typescript/issues/481)) ([5fd7e21](https://github.com/anthropics/anthropic-sdk-typescript/commit/5fd7e219732a4483c2edd9a812049569b31943c4))
* sync openapi version ([#485](https://github.com/anthropics/anthropic-sdk-typescript/issues/485)) ([e74c522](https://github.com/anthropics/anthropic-sdk-typescript/commit/e74c522989cfb979ca916e416c7c14a349b32ef5))
* sync openapi version ([#486](https://github.com/anthropics/anthropic-sdk-typescript/issues/486)) ([ad98e9e](https://github.com/anthropics/anthropic-sdk-typescript/commit/ad98e9eca5db4f5a04bf8c26e4c53050985cec33))

## 0.25.0 (2024-07-29)

Full Changelog: [sdk-v0.24.3...sdk-v0.25.0](https://github.com/anthropics/anthropic-sdk-typescript/compare/sdk-v0.24.3...sdk-v0.25.0)

### Features

* add back compat alias for InputJsonDelta ([8b08161](https://github.com/anthropics/anthropic-sdk-typescript/commit/8b081613a50821b8dfa8a1251d42337a20607411))
* **client:** make request-id header more accessible ([#462](https://github.com/anthropics/anthropic-sdk-typescript/issues/462)) ([5ea6f8b](https://github.com/anthropics/anthropic-sdk-typescript/commit/5ea6f8be0696e3753d8624f72328a5cba3a86056))


### Bug Fixes

* **compat:** remove ReadableStream polyfill redundant since node v16 ([#478](https://github.com/anthropics/anthropic-sdk-typescript/issues/478)) ([75f5710](https://github.com/anthropics/anthropic-sdk-typescript/commit/75f5710d57e6f72b6770d32d9c6dd71bbfb43d85))
* use relative paths ([#475](https://github.com/anthropics/anthropic-sdk-typescript/issues/475)) ([a8ca93c](https://github.com/anthropics/anthropic-sdk-typescript/commit/a8ca93cc40464dc76118f7dd72e94c52693f3d63))


### Chores

* **bedrock:** use `chunk` for internal SSE parsing instead of `completion` ([#472](https://github.com/anthropics/anthropic-sdk-typescript/issues/472)) ([0f6190a](https://github.com/anthropics/anthropic-sdk-typescript/commit/0f6190a69d8986ac3779441eba43d345ec3fb342))
* **ci:** also run workflows for PRs targeting `next` ([#464](https://github.com/anthropics/anthropic-sdk-typescript/issues/464)) ([cc405a8](https://github.com/anthropics/anthropic-sdk-typescript/commit/cc405a8cc4ea26389b9d857d75818722d0bcbfcd))
* **docs:** fix incorrect client var names ([#479](https://github.com/anthropics/anthropic-sdk-typescript/issues/479)) ([a247935](https://github.com/anthropics/anthropic-sdk-typescript/commit/a247935a86b87b90209f493921661d20c9bc6457))
* **docs:** mention lack of support for web browser runtimes ([#468](https://github.com/anthropics/anthropic-sdk-typescript/issues/468)) ([968a7fb](https://github.com/anthropics/anthropic-sdk-typescript/commit/968a7fbb6cb779d17d9f6c485c0b61f241e327bc))
* **docs:** minor update to formatting of API link in README ([#467](https://github.com/anthropics/anthropic-sdk-typescript/issues/467)) ([50b9f2b](https://github.com/anthropics/anthropic-sdk-typescript/commit/50b9f2b0c3feb4707af2b9e5f006a3f726782803))
* **docs:** rename anthropic const to client ([#471](https://github.com/anthropics/anthropic-sdk-typescript/issues/471)) ([e1a7f9f](https://github.com/anthropics/anthropic-sdk-typescript/commit/e1a7f9f813077fb033c732c004c7bda85738a321))
* **docs:** use client instead of package name in Node examples ([#469](https://github.com/anthropics/anthropic-sdk-typescript/issues/469)) ([8961ebf](https://github.com/anthropics/anthropic-sdk-typescript/commit/8961ebf54bbab898667119c8d9551e33a4de6846))
* **internal:** add constant for default timeout ([#480](https://github.com/anthropics/anthropic-sdk-typescript/issues/480)) ([dc89753](https://github.com/anthropics/anthropic-sdk-typescript/commit/dc897537789c6b4bc31ee8238aad8ffaaa65df5e))
* **internal:** minor changes to tests ([#465](https://github.com/anthropics/anthropic-sdk-typescript/issues/465)) ([c1fd563](https://github.com/anthropics/anthropic-sdk-typescript/commit/c1fd563693bd354a81e0ae55c7355144f06b7f0b))
* **internal:** remove old reference to check-test-server ([8dc9afc](https://github.com/anthropics/anthropic-sdk-typescript/commit/8dc9afcf00c4a38c2d85171ebceafc5f6a47c117))
* sync spec ([#470](https://github.com/anthropics/anthropic-sdk-typescript/issues/470)) ([b493aa4](https://github.com/anthropics/anthropic-sdk-typescript/commit/b493aa49d3d6e67be22c3e8255dd4286e6bbcdeb))
* **tests:** update prism version ([#473](https://github.com/anthropics/anthropic-sdk-typescript/issues/473)) ([6f21ecf](https://github.com/anthropics/anthropic-sdk-typescript/commit/6f21ecfd781d04a7dc83641f069bb38d5584a320))


### Refactors

* extract model out to a named type and rename partialjson ([#477](https://github.com/anthropics/anthropic-sdk-typescript/issues/477)) ([d2d4e36](https://github.com/anthropics/anthropic-sdk-typescript/commit/d2d4e36b995cc84e8a3a7c64eb614011df399c5e))

## 0.24.3 (2024-07-01)

Full Changelog: [sdk-v0.24.2...sdk-v0.24.3](https://github.com/anthropics/anthropic-sdk-typescript/compare/sdk-v0.24.2...sdk-v0.24.3)

### Bug Fixes

* **types:** avoid errors on certain TS versions ([dd6aca5](https://github.com/anthropics/anthropic-sdk-typescript/commit/dd6aca56e58d52f09e67e227cccbf273b92adb13))

## 0.24.2 (2024-06-28)

Full Changelog: [sdk-v0.24.1...sdk-v0.24.2](https://github.com/anthropics/anthropic-sdk-typescript/compare/sdk-v0.24.1...sdk-v0.24.2)

### Bug Fixes

* **partial-json:** don't error on unknown tokens ([d212ce1](https://github.com/anthropics/anthropic-sdk-typescript/commit/d212ce152ca0b8846e7891636ad4ba287da50958))
* **partial-json:** handle `null` token properly ([f53742f](https://github.com/anthropics/anthropic-sdk-typescript/commit/f53742f497a33b8f0639a63cec828d430a19cb27))


### Chores

* gitignore test server logs ([#451](https://github.com/anthropics/anthropic-sdk-typescript/issues/451)) ([ee1308f](https://github.com/anthropics/anthropic-sdk-typescript/commit/ee1308f74e5544ed0ce53bfd14ca49d0f03bcffb))
* **tests:** add unit tests for partial-json-parser ([4fb3bea](https://github.com/anthropics/anthropic-sdk-typescript/commit/4fb3bea74538823c8ab359048f823029d4716277))

## 0.24.1 (2024-06-25)

Full Changelog: [sdk-v0.24.0...sdk-v0.24.1](https://github.com/anthropics/anthropic-sdk-typescript/compare/sdk-v0.24.0...sdk-v0.24.1)

### Bug Fixes

* **api:** add string to tool result block ([#448](https://github.com/anthropics/anthropic-sdk-typescript/issues/448)) ([87af4e9](https://github.com/anthropics/anthropic-sdk-typescript/commit/87af4e9280923ac73295f9b32086f82c2ed0c6f2))


### Chores

* **internal:** minor reformatting ([#444](https://github.com/anthropics/anthropic-sdk-typescript/issues/444)) ([46790bb](https://github.com/anthropics/anthropic-sdk-typescript/commit/46790bb462db01ae1725e120f2bdca0a89c8f722))
* **internal:** replace deprecated aws-sdk packages with [@smithy](https://github.com/smithy) ([#447](https://github.com/anthropics/anthropic-sdk-typescript/issues/447)) ([4328cbf](https://github.com/anthropics/anthropic-sdk-typescript/commit/4328cbf9e64f8bfc9b95a9048b18729c9a938ba5))

## 0.24.0 (2024-06-20)

Full Changelog: [sdk-v0.23.0...sdk-v0.24.0](https://github.com/anthropics/anthropic-sdk-typescript/compare/sdk-v0.23.0...sdk-v0.24.0)

### Features

* **api:** add new claude-3-5-sonnet-20240620 model ([#438](https://github.com/anthropics/anthropic-sdk-typescript/issues/438)) ([8d60d1b](https://github.com/anthropics/anthropic-sdk-typescript/commit/8d60d1b6fb14988a2257727a1aaab9fbc8f75be3))

## 0.23.0 (2024-06-14)

Full Changelog: [sdk-v0.22.0...sdk-v0.23.0](https://github.com/anthropics/anthropic-sdk-typescript/compare/sdk-v0.22.0...sdk-v0.23.0)

### Features

* support `application/octet-stream` request bodies ([#436](https://github.com/anthropics/anthropic-sdk-typescript/issues/436)) ([3a8e6ed](https://github.com/anthropics/anthropic-sdk-typescript/commit/3a8e6ed7cc057b77fabeaf8f774f6231836022d7))


### Bug Fixes

* allow git imports for pnpm ([#433](https://github.com/anthropics/anthropic-sdk-typescript/issues/433)) ([a4f5263](https://github.com/anthropics/anthropic-sdk-typescript/commit/a4f5263692aea74fbf91d0591958aca16c820e00))

## 0.22.0 (2024-05-30)

Full Changelog: [sdk-v0.21.1...sdk-v0.22.0](https://github.com/anthropics/anthropic-sdk-typescript/compare/sdk-v0.21.1...sdk-v0.22.0)

### Features

* **api/types:** add stream event type aliases with a Raw prefix ([#428](https://github.com/anthropics/anthropic-sdk-typescript/issues/428)) ([1e367e4](https://github.com/anthropics/anthropic-sdk-typescript/commit/1e367e4020fa4691c565c89bdfba40c2f6060871))
* **api:** tool use is GA and available on 3P ([#429](https://github.com/anthropics/anthropic-sdk-typescript/issues/429)) ([2decf85](https://github.com/anthropics/anthropic-sdk-typescript/commit/2decf85e7471932dad98c21d4ed2d476ab1588a6))
* **bedrock:** support tools ([91fc61a](https://github.com/anthropics/anthropic-sdk-typescript/commit/91fc61ae7246705d26e96a95dae38b46e9ad9290))
* **streaming:** add tools support ([4c83bb1](https://github.com/anthropics/anthropic-sdk-typescript/commit/4c83bb111735cd513c09d5ed57a5cb0888534afd))
* **vertex:** support tools ([acf0aa7](https://github.com/anthropics/anthropic-sdk-typescript/commit/acf0aa7571425c8582740616e24883c2ec65218b))


### Documentation

* **helpers:** mention inputJson event ([0ef0e39](https://github.com/anthropics/anthropic-sdk-typescript/commit/0ef0e39a870541bbe800b03c1bdcf88eb6e1350c))
* **readme:** add bundle size badge ([#426](https://github.com/anthropics/anthropic-sdk-typescript/issues/426)) ([bf7c1fd](https://github.com/anthropics/anthropic-sdk-typescript/commit/bf7c1fdaf3476d5c43079e8a0789ed0dd0c807a6))

## 0.21.1 (2024-05-21)

Full Changelog: [sdk-v0.21.0...sdk-v0.21.1](https://github.com/anthropics/anthropic-sdk-typescript/compare/sdk-v0.21.0...sdk-v0.21.1)

### Chores

* **docs:** fix typo ([#423](https://github.com/anthropics/anthropic-sdk-typescript/issues/423)) ([d42f458](https://github.com/anthropics/anthropic-sdk-typescript/commit/d42f45820347171bd456b0038406a53b098a4fa2))
* **internal:** run build script over sub-packages ([6f04f66](https://github.com/anthropics/anthropic-sdk-typescript/commit/6f04f6689603ef5a59ce15f490d74392241694c3))

## 0.21.0 (2024-05-16)

Full Changelog: [sdk-v0.20.9...sdk-v0.21.0](https://github.com/anthropics/anthropic-sdk-typescript/compare/sdk-v0.20.9...sdk-v0.21.0)

### Features

* **api:** add `tool_choice` param, image block params inside `tool_result.content`, and streaming for `tool_use` blocks ([#418](https://github.com/anthropics/anthropic-sdk-typescript/issues/418)) ([421a1e6](https://github.com/anthropics/anthropic-sdk-typescript/commit/421a1e6f53cbb2f440e3668be3e13475976eebbf))


### Chores

* **docs:** add SECURITY.md ([#411](https://github.com/anthropics/anthropic-sdk-typescript/issues/411)) ([bf2ad84](https://github.com/anthropics/anthropic-sdk-typescript/commit/bf2ad8496d97de46b28575dfa37fa9cf15341eb4))
* **internal:** add slightly better logging to scripts ([#415](https://github.com/anthropics/anthropic-sdk-typescript/issues/415)) ([7a042d2](https://github.com/anthropics/anthropic-sdk-typescript/commit/7a042d2dd5a5e310f15c02277c7f7a19e9772872))
* **internal:** fix generated version numbers ([#413](https://github.com/anthropics/anthropic-sdk-typescript/issues/413)) ([ea77063](https://github.com/anthropics/anthropic-sdk-typescript/commit/ea770630897bb85caaecd39bccf478e4dd3f169c))

## 0.20.9 (2024-05-07)

Full Changelog: [sdk-v0.20.8...sdk-v0.20.9](https://github.com/anthropics/anthropic-sdk-typescript/compare/sdk-v0.20.8...sdk-v0.20.9)

### Bug Fixes

* **package:** revert recent client file change ([#409](https://github.com/anthropics/anthropic-sdk-typescript/issues/409)) ([9054249](https://github.com/anthropics/anthropic-sdk-typescript/commit/90542499ccf9f5d020e71e1c8dc8935e0c86ede4))


### Chores

* **internal:** add link to openapi spec ([#406](https://github.com/anthropics/anthropic-sdk-typescript/issues/406)) ([39c856d](https://github.com/anthropics/anthropic-sdk-typescript/commit/39c856d02abbb1d54efbacef087cc89b79bce017))
* **internal:** bump prism version ([#407](https://github.com/anthropics/anthropic-sdk-typescript/issues/407)) ([0c1eb5d](https://github.com/anthropics/anthropic-sdk-typescript/commit/0c1eb5d5c500ea95fbf9a5ccce37c74170c6a84f))
* **internal:** move client class to separate file ([#408](https://github.com/anthropics/anthropic-sdk-typescript/issues/408)) ([b5e1e4a](https://github.com/anthropics/anthropic-sdk-typescript/commit/b5e1e4a68c9fc00bede9134fa2214480bbbf5f2d))
* **internal:** refactor scripts ([#404](https://github.com/anthropics/anthropic-sdk-typescript/issues/404)) ([f60e2d8](https://github.com/anthropics/anthropic-sdk-typescript/commit/f60e2d81bb241063507d2d7e728c78e78c1c5e51))

## 0.20.8 (2024-04-29)

Full Changelog: [sdk-v0.20.7...sdk-v0.20.8](https://github.com/anthropics/anthropic-sdk-typescript/compare/sdk-v0.20.7...sdk-v0.20.8)

### Chores

* **internal:** add scripts/test and scripts/mock ([#403](https://github.com/anthropics/anthropic-sdk-typescript/issues/403)) ([bdc6011](https://github.com/anthropics/anthropic-sdk-typescript/commit/bdc601192d651f9a7f6bf822c631db1d652d796c))
* **internal:** use actions/checkout@v4 for codeflow ([#400](https://github.com/anthropics/anthropic-sdk-typescript/issues/400)) ([6d565d3](https://github.com/anthropics/anthropic-sdk-typescript/commit/6d565d366f8787e87cbe9ac851e42c13f88c2579))

## 0.20.7 (2024-04-24)

Full Changelog: [sdk-v0.20.6...sdk-v0.20.7](https://github.com/anthropics/anthropic-sdk-typescript/compare/sdk-v0.20.6...sdk-v0.20.7)

### Chores

* **internal:** use @swc/jest for running tests ([#397](https://github.com/anthropics/anthropic-sdk-typescript/issues/397)) ([0dbca67](https://github.com/anthropics/anthropic-sdk-typescript/commit/0dbca679f26f4a301810290601cc41f18525fe6e))

## 0.20.6 (2024-04-17)

Full Changelog: [sdk-v0.20.5...sdk-v0.20.6](https://github.com/anthropics/anthropic-sdk-typescript/compare/sdk-v0.20.5...sdk-v0.20.6)

### Build System

* configure UTF-8 locale in devcontainer ([#393](https://github.com/anthropics/anthropic-sdk-typescript/issues/393)) ([db10244](https://github.com/anthropics/anthropic-sdk-typescript/commit/db10244fa87a653c48bbcc2fffbad206dbe39645))

## 0.20.5 (2024-04-15)

Full Changelog: [sdk-v0.20.4...sdk-v0.20.5](https://github.com/anthropics/anthropic-sdk-typescript/compare/sdk-v0.20.4...sdk-v0.20.5)

### Chores

* **internal:** formatting ([#390](https://github.com/anthropics/anthropic-sdk-typescript/issues/390)) ([b7861b9](https://github.com/anthropics/anthropic-sdk-typescript/commit/b7861b940dc9c1c21eb6edf3bac8d1d62d2d372f))

## 0.20.4 (2024-04-11)

Full Changelog: [sdk-v0.20.3...sdk-v0.20.4](https://github.com/anthropics/anthropic-sdk-typescript/compare/sdk-v0.20.3...sdk-v0.20.4)

### Chores

* **internal:** update gitignore ([#388](https://github.com/anthropics/anthropic-sdk-typescript/issues/388)) ([03f03a2](https://github.com/anthropics/anthropic-sdk-typescript/commit/03f03a22532680a3b9bbd2e49116ef760b07a498))

## 0.20.3 (2024-04-10)

Full Changelog: [sdk-v0.20.2...sdk-v0.20.3](https://github.com/anthropics/anthropic-sdk-typescript/compare/sdk-v0.20.2...sdk-v0.20.3)

### Bug Fixes

* **vertex:** correct core client dependency constraint ([#384](https://github.com/anthropics/anthropic-sdk-typescript/issues/384)) ([de29699](https://github.com/anthropics/anthropic-sdk-typescript/commit/de2969902b68b5c46b6e682b8b947426c6ccf195))

## 0.20.2 (2024-04-09)

Full Changelog: [sdk-v0.20.1...sdk-v0.20.2](https://github.com/anthropics/anthropic-sdk-typescript/compare/sdk-v0.20.1...sdk-v0.20.2)

### Chores

* **internal:** update lock files ([#377](https://github.com/anthropics/anthropic-sdk-typescript/issues/377)) ([6d239ef](https://github.com/anthropics/anthropic-sdk-typescript/commit/6d239efaca730baba374a1b49f6b1a4037b3e163))

## 0.20.1 (2024-04-04)

Full Changelog: [sdk-v0.20.0...sdk-v0.20.1](https://github.com/anthropics/anthropic-sdk-typescript/compare/sdk-v0.20.0...sdk-v0.20.1)

### Documentation

* **readme:** mention tool use ([#375](https://github.com/anthropics/anthropic-sdk-typescript/issues/375)) ([72356dd](https://github.com/anthropics/anthropic-sdk-typescript/commit/72356dd9c498344074c292ffdab602d54c4fa13e))

## 0.20.0 (2024-04-04)

Full Changelog: [sdk-v0.19.2...sdk-v0.20.0](https://github.com/anthropics/anthropic-sdk-typescript/compare/sdk-v0.19.2...sdk-v0.20.0)

### Features

* **api:** tool use beta ([#374](https://github.com/anthropics/anthropic-sdk-typescript/issues/374)) ([e28514a](https://github.com/anthropics/anthropic-sdk-typescript/commit/e28514a305908f71e98bc33123bc99ed6bf7348f))


### Bug Fixes

* **types:** correctly mark type as a required property in requests ([#371](https://github.com/anthropics/anthropic-sdk-typescript/issues/371)) ([a04edd8](https://github.com/anthropics/anthropic-sdk-typescript/commit/a04edd8d7f4c552281b37a44099edf432d7fcb27))


### Chores

* **types:** consistent naming for text block types ([#373](https://github.com/anthropics/anthropic-sdk-typescript/issues/373)) ([84a6a58](https://github.com/anthropics/anthropic-sdk-typescript/commit/84a6a58ff978cc274b85656ca4394396e8b360e3))

## 0.19.2 (2024-04-04)

Full Changelog: [sdk-v0.19.1...sdk-v0.19.2](https://github.com/anthropics/anthropic-sdk-typescript/compare/sdk-v0.19.1...sdk-v0.19.2)

### Bug Fixes

* **streaming:** handle special line characters and fix multi-byte character decoding ([#370](https://github.com/anthropics/anthropic-sdk-typescript/issues/370)) ([7a97b38](https://github.com/anthropics/anthropic-sdk-typescript/commit/7a97b38e389809ef75c307d26fc671c829b5ea29))


### Chores

* **deps:** bump yarn to v1.22.22 ([#369](https://github.com/anthropics/anthropic-sdk-typescript/issues/369)) ([603d7b1](https://github.com/anthropics/anthropic-sdk-typescript/commit/603d7b17411bc25a562acb80ebde71ae058892d0))
* **deps:** remove unused dependency digest-fetch ([#368](https://github.com/anthropics/anthropic-sdk-typescript/issues/368)) ([df1df0f](https://github.com/anthropics/anthropic-sdk-typescript/commit/df1df0f509682841c703fa1ea5062a796cfe2091))


### Documentation

* **readme:** change undocumented params wording ([#363](https://github.com/anthropics/anthropic-sdk-typescript/issues/363)) ([4222e08](https://github.com/anthropics/anthropic-sdk-typescript/commit/4222e088aff5e26a3d2fbe1b622781c6194b0469))

## 0.19.1 (2024-03-29)

Full Changelog: [sdk-v0.19.0...sdk-v0.19.1](https://github.com/anthropics/anthropic-sdk-typescript/compare/sdk-v0.19.0...sdk-v0.19.1)

### Bug Fixes

* **client:** correctly send deno version header ([#354](https://github.com/anthropics/anthropic-sdk-typescript/issues/354)) ([ad5162b](https://github.com/anthropics/anthropic-sdk-typescript/commit/ad5162be2ccb122eb355577f481732121b130b0b))
* handle process.env being undefined in debug func ([#351](https://github.com/anthropics/anthropic-sdk-typescript/issues/351)) ([3b0f38a](https://github.com/anthropics/anthropic-sdk-typescript/commit/3b0f38ab427ae7d31c800cd5c8be1653da9ae709))
* **streaming:** correct accumulation of output tokens ([#361](https://github.com/anthropics/anthropic-sdk-typescript/issues/361)) ([76af283](https://github.com/anthropics/anthropic-sdk-typescript/commit/76af283596530ccd3a77ed86788bc0ea1e93f3c1))
* **types:** correct typo claude-2.1' to claude-2.1 ([#352](https://github.com/anthropics/anthropic-sdk-typescript/issues/352)) ([0d5efb9](https://github.com/anthropics/anthropic-sdk-typescript/commit/0d5efb9a0b9eb3ebe1df5ed10164fadfd886eac6))


### Chores

* **internal:** add type ([#359](https://github.com/anthropics/anthropic-sdk-typescript/issues/359)) ([9456414](https://github.com/anthropics/anthropic-sdk-typescript/commit/945641467deffb674f762920955c98d10f287c8e))


### Documentation

* **bedrock:** fix dead link ([#356](https://github.com/anthropics/anthropic-sdk-typescript/issues/356)) ([a953e00](https://github.com/anthropics/anthropic-sdk-typescript/commit/a953e0070698f3238b728ffe06a056a9f2d6b7ff))
* **readme:** consistent use of sentence case in headings ([#347](https://github.com/anthropics/anthropic-sdk-typescript/issues/347)) ([30f45d1](https://github.com/anthropics/anthropic-sdk-typescript/commit/30f45d14a534d7392dfcc4fb503bf07ab8cf038d))
* **readme:** document how to make undocumented requests ([#349](https://github.com/anthropics/anthropic-sdk-typescript/issues/349)) ([f92c50a](https://github.com/anthropics/anthropic-sdk-typescript/commit/f92c50ac6d9d1b8bdb837e52414aafd3224553da))

## 0.19.0 (2024-03-19)

Full Changelog: [sdk-v0.18.0...sdk-v0.19.0](https://github.com/anthropics/anthropic-sdk-typescript/compare/sdk-v0.18.0...sdk-v0.19.0)

### Features

* **vertex:** add support for overriding google auth ([#338](https://github.com/anthropics/anthropic-sdk-typescript/issues/338)) ([28d98c4](https://github.com/anthropics/anthropic-sdk-typescript/commit/28d98c487257a3c6b3c6d84597768d484fadb86d))
* **vertex:** api is no longer in private beta ([#344](https://github.com/anthropics/anthropic-sdk-typescript/issues/344)) ([892127c](https://github.com/anthropics/anthropic-sdk-typescript/commit/892127cdac059eee11c1a322a5512f9250868023))


### Bug Fixes

* **internal:** make toFile use input file's options ([#343](https://github.com/anthropics/anthropic-sdk-typescript/issues/343)) ([2dc2174](https://github.com/anthropics/anthropic-sdk-typescript/commit/2dc217441d6da8f2192b3e81b03c985383b6816e))


### Chores

* **internal:** update generated pragma comment ([#341](https://github.com/anthropics/anthropic-sdk-typescript/issues/341)) ([fd60f63](https://github.com/anthropics/anthropic-sdk-typescript/commit/fd60f63d5e5cd978b287d66fd95deabe2ff089d2))


### Documentation

* fix typo in CONTRIBUTING.md ([#340](https://github.com/anthropics/anthropic-sdk-typescript/issues/340)) ([ba9f3fa](https://github.com/anthropics/anthropic-sdk-typescript/commit/ba9f3faa5e3d116fce232d81f554b2f95f573ec8))

## 0.18.0 (2024-03-13)

Full Changelog: [sdk-v0.17.2...sdk-v0.18.0](https://github.com/anthropics/anthropic-sdk-typescript/compare/sdk-v0.17.2...sdk-v0.18.0)

### Features

* **api:** add haiku model ([#333](https://github.com/anthropics/anthropic-sdk-typescript/issues/333)) ([11becc6](https://github.com/anthropics/anthropic-sdk-typescript/commit/11becc64a8b07b353835678e063a70e3a0bd85e3))


### Documentation

* update models in vertex examples ([#331](https://github.com/anthropics/anthropic-sdk-typescript/issues/331)) ([3d139b3](https://github.com/anthropics/anthropic-sdk-typescript/commit/3d139b374179ef5540a8e9436df06501c6ada6c5))

## 0.17.2 (2024-03-12)

Full Changelog: [sdk-v0.17.1...sdk-v0.17.2](https://github.com/anthropics/anthropic-sdk-typescript/compare/sdk-v0.17.1...sdk-v0.17.2)

### Chores

* **internal:** add explicit type annotation to decoder ([#324](https://github.com/anthropics/anthropic-sdk-typescript/issues/324)) ([7e172c7](https://github.com/anthropics/anthropic-sdk-typescript/commit/7e172c74f75414ee246cbd71104454c9e81efc0d))

## 0.17.1 (2024-03-06)

Full Changelog: [sdk-v0.17.0...sdk-v0.17.1](https://github.com/anthropics/anthropic-sdk-typescript/compare/sdk-v0.17.0...sdk-v0.17.1)

### Documentation

* deprecate old access token getter ([#322](https://github.com/anthropics/anthropic-sdk-typescript/issues/322)) ([1110548](https://github.com/anthropics/anthropic-sdk-typescript/commit/1110548d4543fab83bc0ef3beb99a75711cb028a))
* remove extraneous --save and yarn install instructions ([#323](https://github.com/anthropics/anthropic-sdk-typescript/issues/323)) ([775ecb9](https://github.com/anthropics/anthropic-sdk-typescript/commit/775ecb9ef3ab17e88dabc149faa0876cd6ab5f0b))

## 0.17.0 (2024-03-06)

Full Changelog: [sdk-v0.16.1...sdk-v0.17.0](https://github.com/anthropics/anthropic-sdk-typescript/compare/sdk-v0.16.1...sdk-v0.17.0)

### Features

* **api:** add enum to model param for message ([#315](https://github.com/anthropics/anthropic-sdk-typescript/issues/315)) ([0c44de0](https://github.com/anthropics/anthropic-sdk-typescript/commit/0c44de01a5d5fc6dda3667f03779eb029247c18e))


### Bug Fixes

* **streaming:** correctly handle trailing new lines in byte chunks ([#317](https://github.com/anthropics/anthropic-sdk-typescript/issues/317)) ([0147b46](https://github.com/anthropics/anthropic-sdk-typescript/commit/0147b4693bd4b1dc3c9cba04a7082aad3c3cb42c))


### Chores

* **types:** fix accidental exposure of Buffer type to cloudflare ([#319](https://github.com/anthropics/anthropic-sdk-typescript/issues/319)) ([a5e4462](https://github.com/anthropics/anthropic-sdk-typescript/commit/a5e4462bcf054e8324cbcaa31d1b85ffc58113fd))


### Documentation

* **readme:** fix https proxy example ([#310](https://github.com/anthropics/anthropic-sdk-typescript/issues/310)) ([99d3c54](https://github.com/anthropics/anthropic-sdk-typescript/commit/99d3c545f45230ec5862ddbbfcb64f46b54d7d13))
* **readme:** fix https proxy example ([#311](https://github.com/anthropics/anthropic-sdk-typescript/issues/311)) ([ffb603c](https://github.com/anthropics/anthropic-sdk-typescript/commit/ffb603c15a0f5d396c96ac545a0cdd0c814ec4ef))

## 0.16.1 (2024-03-04)

Full Changelog: [sdk-v0.16.0...sdk-v0.16.1](https://github.com/anthropics/anthropic-sdk-typescript/compare/sdk-v0.16.0...sdk-v0.16.1)

### Chores

* fix error handler in readme ([#307](https://github.com/anthropics/anthropic-sdk-typescript/issues/307)) ([5007a1e](https://github.com/anthropics/anthropic-sdk-typescript/commit/5007a1e71907648ea44e1663f5b7f71bb20d001d))


### Documentation

* **readme:** reference bedrock sdk ([#309](https://github.com/anthropics/anthropic-sdk-typescript/issues/309)) ([0fd0416](https://github.com/anthropics/anthropic-sdk-typescript/commit/0fd041617eca18dd506efffe5a4e2505dd1aa004))

## 0.16.0 (2024-03-04)

Full Changelog: [sdk-v0.15.0...sdk-v0.16.0](https://github.com/anthropics/anthropic-sdk-typescript/compare/sdk-v0.15.0...sdk-v0.16.0)

### Features

* **bedrock:** add messages API ([#305](https://github.com/anthropics/anthropic-sdk-typescript/issues/305)) ([8b7f89e](https://github.com/anthropics/anthropic-sdk-typescript/commit/8b7f89e1e60416f9ad5b575d43238a4259654395))


### Chores

* update examples ([459956a](https://github.com/anthropics/anthropic-sdk-typescript/commit/459956ac44b5a2fd1dd0d0828e0281875b5900e9))

## 0.15.0 (2024-03-04)

Full Changelog: [sdk-v0.14.1...sdk-v0.15.0](https://github.com/anthropics/anthropic-sdk-typescript/compare/sdk-v0.14.1...sdk-v0.15.0)

### Features

* **messages:** add support for image inputs ([#303](https://github.com/anthropics/anthropic-sdk-typescript/issues/303)) ([7663bd6](https://github.com/anthropics/anthropic-sdk-typescript/commit/7663bd6e1a4427483cf5f13889bc5c63314e5bae))


### Bug Fixes

* **MessageStream:** handle errors more gracefully in async iterator ([#301](https://github.com/anthropics/anthropic-sdk-typescript/issues/301)) ([9cc0daa](https://github.com/anthropics/anthropic-sdk-typescript/commit/9cc0daa9af5717953933e12b487bdbdd5b762cc7))


### Chores

* **docs:** mention install from git repo ([#302](https://github.com/anthropics/anthropic-sdk-typescript/issues/302)) ([dd2627b](https://github.com/anthropics/anthropic-sdk-typescript/commit/dd2627bc6404afbdccb2c2b66ee0dfcc3fc80031))
* **internal:** update deps ([#296](https://github.com/anthropics/anthropic-sdk-typescript/issues/296)) ([8804a92](https://github.com/anthropics/anthropic-sdk-typescript/commit/8804a92e3c873d712cac75089af0e82104e6381c))


### Documentation

* **contributing:** improve wording ([#299](https://github.com/anthropics/anthropic-sdk-typescript/issues/299)) ([7697fa1](https://github.com/anthropics/anthropic-sdk-typescript/commit/7697fa1a3b680015c55ed715a1496c727630a3dc))
* **readme:** fix typo in custom fetch implementation ([#300](https://github.com/anthropics/anthropic-sdk-typescript/issues/300)) ([a4974c3](https://github.com/anthropics/anthropic-sdk-typescript/commit/a4974c3080c6b592c2a25367932481a154e6c280))

## 0.14.1 (2024-02-22)

Full Changelog: [sdk-v0.14.0...sdk-v0.14.1](https://github.com/anthropics/anthropic-sdk-typescript/compare/sdk-v0.14.0...sdk-v0.14.1)

### Chores

* **ci:** update actions/setup-node action to v4 ([#295](https://github.com/anthropics/anthropic-sdk-typescript/issues/295)) ([359a856](https://github.com/anthropics/anthropic-sdk-typescript/commit/359a856c4c93d962ca3e117f4dd799849eb5fa7d))
* **docs:** remove references to old bedrock package ([#289](https://github.com/anthropics/anthropic-sdk-typescript/issues/289)) ([33b935e](https://github.com/anthropics/anthropic-sdk-typescript/commit/33b935e3d840346dd464445901846d2b22888e1c))
* **internal:** refactor release environment script ([#294](https://github.com/anthropics/anthropic-sdk-typescript/issues/294)) ([b7f8714](https://github.com/anthropics/anthropic-sdk-typescript/commit/b7f87143b16ad413adb943297e65473fd9b93b71))


### Documentation

* **readme:** fix header for streaming helpers ([#293](https://github.com/anthropics/anthropic-sdk-typescript/issues/293)) ([7278e6f](https://github.com/anthropics/anthropic-sdk-typescript/commit/7278e6f7d62d837c2af0b1a440dfa97b6a3f6b4e))


### Refactors

* **api:** mark completions API as legacy ([#291](https://github.com/anthropics/anthropic-sdk-typescript/issues/291)) ([c78e2e2](https://github.com/anthropics/anthropic-sdk-typescript/commit/c78e2e215067fabcc3eaee0a537213f55735b42e))

## 0.14.0 (2024-02-13)

Full Changelog: [sdk-v0.13.1...sdk-v0.14.0](https://github.com/anthropics/anthropic-sdk-typescript/compare/sdk-v0.13.1...sdk-v0.14.0)

### ⚠ BREAKING CHANGES

* **api:** messages is generally available ([#287](https://github.com/anthropics/anthropic-sdk-typescript/issues/287))

### Features

* **api:** messages is generally available ([#287](https://github.com/anthropics/anthropic-sdk-typescript/issues/287)) ([be0a828](https://github.com/anthropics/anthropic-sdk-typescript/commit/be0a82883cf9b1b9d2944525b86e40f2b42cea4f))

## 0.13.1 (2024-02-07)

Full Changelog: [sdk-v0.13.0...sdk-v0.13.1](https://github.com/anthropics/anthropic-sdk-typescript/compare/sdk-v0.13.0...sdk-v0.13.1)

### Chores

* **internal:** reformat pacakge.json ([#284](https://github.com/anthropics/anthropic-sdk-typescript/issues/284)) ([3760c68](https://github.com/anthropics/anthropic-sdk-typescript/commit/3760c68f207b596261da336cbe62b4b84fb1763f))
* respect `application/vnd.api+json` content-type header ([#286](https://github.com/anthropics/anthropic-sdk-typescript/issues/286)) ([daf0cae](https://github.com/anthropics/anthropic-sdk-typescript/commit/daf0cae6087580d61d4423e113259c8315c2b85a))

## 0.13.0 (2024-02-02)

Full Changelog: [sdk-v0.12.8...sdk-v0.13.0](https://github.com/anthropics/anthropic-sdk-typescript/compare/sdk-v0.12.8...sdk-v0.13.0)

### Features

* **api:** add new usage response fields ([#281](https://github.com/anthropics/anthropic-sdk-typescript/issues/281)) ([77bd18f](https://github.com/anthropics/anthropic-sdk-typescript/commit/77bd18fb3d149c0706664304102fc5f12830f761))


### Chores

* **package:** fix formatting ([#283](https://github.com/anthropics/anthropic-sdk-typescript/issues/283)) ([f88579a](https://github.com/anthropics/anthropic-sdk-typescript/commit/f88579a0768e0a7d5064eec9e1dd79e86c66bce7))

## 0.12.8 (2024-02-02)

Full Changelog: [sdk-v0.12.7...sdk-v0.12.8](https://github.com/anthropics/anthropic-sdk-typescript/compare/sdk-v0.12.7...sdk-v0.12.8)

### Chores

* **interal:** make link to api.md relative ([#278](https://github.com/anthropics/anthropic-sdk-typescript/issues/278)) ([46f8c28](https://github.com/anthropics/anthropic-sdk-typescript/commit/46f8c2805af75a5a733fdaa53936765a483471cb))
* **internal:** enable building when git installed ([#279](https://github.com/anthropics/anthropic-sdk-typescript/issues/279)) ([3065001](https://github.com/anthropics/anthropic-sdk-typescript/commit/3065001610041b0c74cc640b72f646b6ff867db1))


### Documentation

* add a CONTRIBUTING.md ([#280](https://github.com/anthropics/anthropic-sdk-typescript/issues/280)) ([5b53551](https://github.com/anthropics/anthropic-sdk-typescript/commit/5b535512f2eacdb9f2fef795c85f2d2aaeedaea3))

## 0.12.7 (2024-01-31)

Full Changelog: [sdk-v0.12.6...sdk-v0.12.7](https://github.com/anthropics/anthropic-sdk-typescript/compare/sdk-v0.12.6...sdk-v0.12.7)

### Chores

* **bedrock:** move bedrock SDK to the main repo ([#274](https://github.com/anthropics/anthropic-sdk-typescript/issues/274)) ([b4ef3a8](https://github.com/anthropics/anthropic-sdk-typescript/commit/b4ef3a854e447744a1e270ec1e7e6da81b98ade3))
* **ci:** fix publish packages script ([#272](https://github.com/anthropics/anthropic-sdk-typescript/issues/272)) ([db3585d](https://github.com/anthropics/anthropic-sdk-typescript/commit/db3585daf759c9794ec307b05a568527a2e7df99))

## 0.12.6 (2024-01-30)

Full Changelog: [sdk-v0.12.5...sdk-v0.12.6](https://github.com/anthropics/anthropic-sdk-typescript/compare/sdk-v0.12.5...sdk-v0.12.6)

### Chores

* **internal:** support pre-release versioning ([#270](https://github.com/anthropics/anthropic-sdk-typescript/issues/270)) ([566069d](https://github.com/anthropics/anthropic-sdk-typescript/commit/566069d4eb1dbcc2123f4b455f855b0748d586ee))

## 0.12.5 (2024-01-25)

Full Changelog: [sdk-v0.12.4...sdk-v0.12.5](https://github.com/anthropics/anthropic-sdk-typescript/compare/sdk-v0.12.4...sdk-v0.12.5)

### Chores

* **internal:** don't re-export streaming type ([#267](https://github.com/anthropics/anthropic-sdk-typescript/issues/267)) ([bcae5a9](https://github.com/anthropics/anthropic-sdk-typescript/commit/bcae5a95078dfe091d01823cd38cf3c63d28026d))
* **internal:** update release-please config ([#269](https://github.com/anthropics/anthropic-sdk-typescript/issues/269)) ([80952e6](https://github.com/anthropics/anthropic-sdk-typescript/commit/80952e6ff6aea24ade9ea45dcbe8bb61da385304))

## 0.12.4 (2024-01-23)

Full Changelog: [sdk-v0.12.3...sdk-v0.12.4](https://github.com/anthropics/anthropic-sdk-typescript/compare/sdk-v0.12.3...sdk-v0.12.4)

### Chores

* **internal:** add internal helpers & improve build scripts ([#261](https://github.com/anthropics/anthropic-sdk-typescript/issues/261)) ([4c1504a](https://github.com/anthropics/anthropic-sdk-typescript/commit/4c1504abc7eb8685a8409c4a19dc46d83ea26392))
* **internal:** minor streaming updates ([#264](https://github.com/anthropics/anthropic-sdk-typescript/issues/264)) ([d4414ff](https://github.com/anthropics/anthropic-sdk-typescript/commit/d4414ffeafbc47769b91c4b2681f130b46d1a7c1))
* **internal:** update resource client type ([#263](https://github.com/anthropics/anthropic-sdk-typescript/issues/263)) ([bc4f115](https://github.com/anthropics/anthropic-sdk-typescript/commit/bc4f115900cbeba1ff09d6f3cec79e639a8fda5e))

## 0.12.3 (2024-01-19)

Full Changelog: [v0.12.2...v0.12.3](https://github.com/anthropics/anthropic-sdk-typescript/compare/v0.12.2...v0.12.3)

### Bug Fixes

* allow body type in RequestOptions to be null ([#259](https://github.com/anthropics/anthropic-sdk-typescript/issues/259)) ([2f98de1](https://github.com/anthropics/anthropic-sdk-typescript/commit/2f98de1a42568b1242ce313ba046febb1c6625b5))

## 0.12.2 (2024-01-18)

Full Changelog: [v0.12.1...v0.12.2](https://github.com/anthropics/anthropic-sdk-typescript/compare/v0.12.1...v0.12.2)

### Bug Fixes

* **ci:** ignore stainless-app edits to release PR title ([#258](https://github.com/anthropics/anthropic-sdk-typescript/issues/258)) ([87e4ba8](https://github.com/anthropics/anthropic-sdk-typescript/commit/87e4ba82c5b498f881db9590edbfd68c8aba0930))
* **types:** accept undefined for optional client options ([#257](https://github.com/anthropics/anthropic-sdk-typescript/issues/257)) ([a0e2c4a](https://github.com/anthropics/anthropic-sdk-typescript/commit/a0e2c4a4c4a269ad011d9a6c717c1ded2405711b))
* use default base url if BASE_URL env var is blank ([#250](https://github.com/anthropics/anthropic-sdk-typescript/issues/250)) ([e38f32f](https://github.com/anthropics/anthropic-sdk-typescript/commit/e38f32f52398f3a082eb745e85179242ecee7663))


### Chores

* **internal:** debug logging for retries; speculative retry-after-ms support ([#256](https://github.com/anthropics/anthropic-sdk-typescript/issues/256)) ([b4b70fd](https://github.com/anthropics/anthropic-sdk-typescript/commit/b4b70fdbee45dd2a68e46135db45b61381538ae8))
* **internal:** narrow type into stringifyQuery ([#253](https://github.com/anthropics/anthropic-sdk-typescript/issues/253)) ([3f42e07](https://github.com/anthropics/anthropic-sdk-typescript/commit/3f42e0702ab55cd841c0dc186732028d2fb9f5bb))


### Documentation

* fix missing async in readme code sample ([#255](https://github.com/anthropics/anthropic-sdk-typescript/issues/255)) ([553fb37](https://github.com/anthropics/anthropic-sdk-typescript/commit/553fb37159a9424a40df1e0f6bb36962ba9f5be8))
* **readme:** improve api reference ([#254](https://github.com/anthropics/anthropic-sdk-typescript/issues/254)) ([3721927](https://github.com/anthropics/anthropic-sdk-typescript/commit/3721927e895d42c167e2464f30f7f2addb690ec6))

## 0.12.1 (2024-01-08)

Full Changelog: [v0.12.0...v0.12.1](https://github.com/anthropics/anthropic-sdk-typescript/compare/v0.12.0...v0.12.1)

### Bug Fixes

* **headers:** always send lowercase headers and strip undefined (BREAKING in rare cases) ([#245](https://github.com/anthropics/anthropic-sdk-typescript/issues/245)) ([7703066](https://github.com/anthropics/anthropic-sdk-typescript/commit/77030661f5612ea5312cb2fecf7987024ffd6ede))


### Chores

* add .keep files for examples and custom code directories ([#249](https://github.com/anthropics/anthropic-sdk-typescript/issues/249)) ([26b9062](https://github.com/anthropics/anthropic-sdk-typescript/commit/26b9062c7489dd3ee7f620edfea9888f92a859d7))
* **internal:** improve type signatures ([#247](https://github.com/anthropics/anthropic-sdk-typescript/issues/247)) ([40edd29](https://github.com/anthropics/anthropic-sdk-typescript/commit/40edd299a83f1f60e973080d1fa84f6f42752663))

## 0.12.0 (2023-12-21)

Full Changelog: [v0.11.0...v0.12.0](https://github.com/anthropics/anthropic-sdk-typescript/compare/v0.11.0...v0.12.0)

### ⚠ BREAKING CHANGES

* remove anthropic-beta and x-api-key headers from param types ([#243](https://github.com/anthropics/anthropic-sdk-typescript/issues/243))

### Bug Fixes

* remove anthropic-beta and x-api-key headers from param types ([#243](https://github.com/anthropics/anthropic-sdk-typescript/issues/243)) ([60f67ae](https://github.com/anthropics/anthropic-sdk-typescript/commit/60f67ae757cfe8e482327f508a802b30ec3805a0))


### Documentation

* **readme:** add streaming helper documentation ([#238](https://github.com/anthropics/anthropic-sdk-typescript/issues/238)) ([d74ee71](https://github.com/anthropics/anthropic-sdk-typescript/commit/d74ee7159f366a3f78091eacdcea3049c1e81ec7))
* **readme:** remove old migration guide ([#236](https://github.com/anthropics/anthropic-sdk-typescript/issues/236)) ([65dff0a](https://github.com/anthropics/anthropic-sdk-typescript/commit/65dff0adb2ec836b81da4f71fb94a316c5f1a942))
* reformat README.md ([#241](https://github.com/anthropics/anthropic-sdk-typescript/issues/241)) ([eb12705](https://github.com/anthropics/anthropic-sdk-typescript/commit/eb12705a7d975f584ca31f24b99c35318cf6419b))


### Refactors

* write jest config in typescript ([#239](https://github.com/anthropics/anthropic-sdk-typescript/issues/239)) ([7c87f24](https://github.com/anthropics/anthropic-sdk-typescript/commit/7c87f242d921adfbd2bb21ed5f2c37ada2043f95))

## 0.11.0 (2023-12-19)

Full Changelog: [v0.10.2...v0.11.0](https://github.com/anthropics/anthropic-sdk-typescript/compare/v0.10.2...v0.11.0)

### Features

* **api:** add messages endpoint with streaming helpers ([#235](https://github.com/anthropics/anthropic-sdk-typescript/issues/235)) ([12b914f](https://github.com/anthropics/anthropic-sdk-typescript/commit/12b914f46f4aa625ff141ec0b6631400d0994f76))
* **client:** support reading the base url from an env variable ([#223](https://github.com/anthropics/anthropic-sdk-typescript/issues/223)) ([5bc3600](https://github.com/anthropics/anthropic-sdk-typescript/commit/5bc3600a487e7ed49d944aaf36a43e0d895e907b))


### Chores

* **ci:** run release workflow once per day ([#232](https://github.com/anthropics/anthropic-sdk-typescript/issues/232)) ([115479f](https://github.com/anthropics/anthropic-sdk-typescript/commit/115479f403838a6d2c81587220029b68a4371c02))
* **deps:** update dependency ts-jest to v29.1.1 ([#233](https://github.com/anthropics/anthropic-sdk-typescript/issues/233)) ([bec6ab1](https://github.com/anthropics/anthropic-sdk-typescript/commit/bec6ab127d9b20071ab673e8e37087a879467b74))
* **deps:** update jest ([#234](https://github.com/anthropics/anthropic-sdk-typescript/issues/234)) ([5506174](https://github.com/anthropics/anthropic-sdk-typescript/commit/5506174092d5248354f3d288c84da5ba4749375c))
* update dependencies ([#231](https://github.com/anthropics/anthropic-sdk-typescript/issues/231)) ([4e34536](https://github.com/anthropics/anthropic-sdk-typescript/commit/4e345362c9002528fb0d95ca739fb8211ab3aec8))
* update prettier ([#230](https://github.com/anthropics/anthropic-sdk-typescript/issues/230)) ([173603e](https://github.com/anthropics/anthropic-sdk-typescript/commit/173603e14fc5fe87c056553ecec3278059fe58d9))


### Documentation

* update examples to show claude-2.1 ([#227](https://github.com/anthropics/anthropic-sdk-typescript/issues/227)) ([4b00d84](https://github.com/anthropics/anthropic-sdk-typescript/commit/4b00d84aee56090b5d576fdff9c3a07386475c72))


### Build System

* specify `packageManager: yarn` ([#229](https://github.com/anthropics/anthropic-sdk-typescript/issues/229)) ([d31dae4](https://github.com/anthropics/anthropic-sdk-typescript/commit/d31dae455d750a61ae3b9a751ab73309b0f87417))

## 0.10.2 (2023-11-28)

Full Changelog: [v0.10.1...v0.10.2](https://github.com/anthropics/anthropic-sdk-typescript/compare/v0.10.1...v0.10.2)

## 0.10.1 (2023-11-24)

Full Changelog: [v0.10.0...v0.10.1](https://github.com/anthropics/anthropic-sdk-typescript/compare/v0.10.0...v0.10.1)

### Chores

* **internal:** remove file import and conditionally run prepare ([#217](https://github.com/anthropics/anthropic-sdk-typescript/issues/217)) ([8ac5c7a](https://github.com/anthropics/anthropic-sdk-typescript/commit/8ac5c7ae63a7aa4262ad95e0f4d6a509428de794))

## 0.10.0 (2023-11-21)

Full Changelog: [v0.9.1...v0.10.0](https://github.com/anthropics/anthropic-sdk-typescript/compare/v0.9.1...v0.10.0)

### Features

* allow installing package directly from github ([#215](https://github.com/anthropics/anthropic-sdk-typescript/issues/215)) ([3de3f1b](https://github.com/anthropics/anthropic-sdk-typescript/commit/3de3f1b8124c110ead3ebedf709f4d5d088230cd))


### Chores

* **ci:** fix publish-npm ([#213](https://github.com/anthropics/anthropic-sdk-typescript/issues/213)) ([4ab77b7](https://github.com/anthropics/anthropic-sdk-typescript/commit/4ab77b7b323f22019193ba4f0a85fc89af193fbf))
* **internal:** don't call prepare in dist ([#216](https://github.com/anthropics/anthropic-sdk-typescript/issues/216)) ([b031904](https://github.com/anthropics/anthropic-sdk-typescript/commit/b031904901a17878545cd8ce5c43f03cd364a8fe))

## 0.9.1 (2023-11-14)

Full Changelog: [v0.9.0...v0.9.1](https://github.com/anthropics/anthropic-sdk-typescript/compare/v0.9.0...v0.9.1)

### Chores

* **ci:** update release-please config ([#206](https://github.com/anthropics/anthropic-sdk-typescript/issues/206)) ([270b0b7](https://github.com/anthropics/anthropic-sdk-typescript/commit/270b0b725ea559ca4616ec8d8bac5a5cde1de0db))
* **docs:** fix github links ([#208](https://github.com/anthropics/anthropic-sdk-typescript/issues/208)) ([b316603](https://github.com/anthropics/anthropic-sdk-typescript/commit/b3166033cffe31f5d11793ddd32e595161f1a2e6))
* **internal:** update APIResource structure ([#211](https://github.com/anthropics/anthropic-sdk-typescript/issues/211)) ([0d6bbce](https://github.com/anthropics/anthropic-sdk-typescript/commit/0d6bbce8ff699b511133ee6bfb72c1244d85eb32))
* **internal:** update jest config ([#210](https://github.com/anthropics/anthropic-sdk-typescript/issues/210)) ([b0c64eb](https://github.com/anthropics/anthropic-sdk-typescript/commit/b0c64eb9531d417f024567a4c74d9dd64743b889))
* **internal:** update tsconfig ([#209](https://github.com/anthropics/anthropic-sdk-typescript/issues/209)) ([81b3e0b](https://github.com/anthropics/anthropic-sdk-typescript/commit/81b3e0b59801f737c6f1783e59eef8c1af77b1ad))

## 0.9.0 (2023-11-05)

Full Changelog: [v0.8.1...v0.9.0](https://github.com/anthropics/anthropic-sdk-typescript/compare/v0.8.1...v0.9.0)

### Features

* **client:** allow binary returns ([#203](https://github.com/anthropics/anthropic-sdk-typescript/issues/203)) ([5983d5e](https://github.com/anthropics/anthropic-sdk-typescript/commit/5983d5e5de327d6835c7baaea022914a101865a2))
* **github:** include a devcontainer setup ([#202](https://github.com/anthropics/anthropic-sdk-typescript/issues/202)) ([ea97913](https://github.com/anthropics/anthropic-sdk-typescript/commit/ea97913a04a508da7704758b78a9b96d097be5a2))


### Chores

* **internal:** update gitignore ([#198](https://github.com/anthropics/anthropic-sdk-typescript/issues/198)) ([3048738](https://github.com/anthropics/anthropic-sdk-typescript/commit/3048738235b9dff9de19aae59ff66487dffb9e8e))
* small cleanups ([#201](https://github.com/anthropics/anthropic-sdk-typescript/issues/201)) ([9f0a73d](https://github.com/anthropics/anthropic-sdk-typescript/commit/9f0a73d794fc110689ce1c67b68d0a68133adb8d))


### Documentation

* document customizing fetch ([#204](https://github.com/anthropics/anthropic-sdk-typescript/issues/204)) ([d2df724](https://github.com/anthropics/anthropic-sdk-typescript/commit/d2df7246ec244f2de73d359ffbff3f88acec781d))
* fix github links ([#200](https://github.com/anthropics/anthropic-sdk-typescript/issues/200)) ([4038acd](https://github.com/anthropics/anthropic-sdk-typescript/commit/4038acd91f4de7c3b20efe7f76523d1e6970f5d9))
* **readme:** mention version header ([#205](https://github.com/anthropics/anthropic-sdk-typescript/issues/205)) ([a8d8f07](https://github.com/anthropics/anthropic-sdk-typescript/commit/a8d8f07f9d4890195847b6ea86eb311e258e655f))

## 0.8.1 (2023-10-25)

Full Changelog: [v0.8.0...v0.8.1](https://github.com/anthropics/anthropic-sdk-typescript/compare/v0.8.0...v0.8.1)

### Bug Fixes

* typo in build script ([#197](https://github.com/anthropics/anthropic-sdk-typescript/issues/197)) ([212e990](https://github.com/anthropics/anthropic-sdk-typescript/commit/212e9903e9b72b3169f450d8ab11ebd384951dba))

## 0.8.0 (2023-10-24)

Full Changelog: [v0.7.0...v0.8.0](https://github.com/anthropics/anthropic-sdk-typescript/compare/v0.7.0...v0.8.0)

### Features

* **client:** adjust retry behavior to be exponential backoff ([#192](https://github.com/anthropics/anthropic-sdk-typescript/issues/192)) ([747afe2](https://github.com/anthropics/anthropic-sdk-typescript/commit/747afe2bdbbe3a5489e9b9bc6ed4fcf2a276e40b))

## 0.7.0 (2023-10-19)

Full Changelog: [v0.6.8...v0.7.0](https://github.com/anthropics/anthropic-sdk-typescript/compare/v0.6.8...v0.7.0)

### Features

* handle 204 No Content gracefully ([#190](https://github.com/anthropics/anthropic-sdk-typescript/issues/190)) ([c8a8bec](https://github.com/anthropics/anthropic-sdk-typescript/commit/c8a8becd127e5275333900c3bb76955605ae0f02))

## 0.6.8 (2023-10-17)

Full Changelog: [v0.6.7...v0.6.8](https://github.com/anthropics/anthropic-sdk-typescript/compare/v0.6.7...v0.6.8)

### Bug Fixes

* import web-streams-polyfill without overriding globals ([#186](https://github.com/anthropics/anthropic-sdk-typescript/issues/186)) ([e774e17](https://github.com/anthropics/anthropic-sdk-typescript/commit/e774e1774642668e080de5233aeaa33cf5f1b3ae))

## 0.6.7 (2023-10-16)

Full Changelog: [v0.6.6...v0.6.7](https://github.com/anthropics/anthropic-sdk-typescript/compare/v0.6.6...v0.6.7)

### Bug Fixes

* improve status code in error messages ([#183](https://github.com/anthropics/anthropic-sdk-typescript/issues/183)) ([7d3bbd4](https://github.com/anthropics/anthropic-sdk-typescript/commit/7d3bbd485c9628bb7c3fb5d1660934198981fcc7))


### Chores

* add case insensitive get header function ([#178](https://github.com/anthropics/anthropic-sdk-typescript/issues/178)) ([13c398d](https://github.com/anthropics/anthropic-sdk-typescript/commit/13c398dee3ff2eaa3b6046630eda9831580348f4))
* **internal:** add debug logs for stream responses ([#182](https://github.com/anthropics/anthropic-sdk-typescript/issues/182)) ([a1fa1b7](https://github.com/anthropics/anthropic-sdk-typescript/commit/a1fa1b7766248f3178cb55ac5342409a57c1dbb8))
* update comment ([#179](https://github.com/anthropics/anthropic-sdk-typescript/issues/179)) ([27a425e](https://github.com/anthropics/anthropic-sdk-typescript/commit/27a425ee64dcdc569b92ac27b501bca0dadf2dea))


### Documentation

* organisation -&gt; organization (UK to US English) ([#185](https://github.com/anthropics/anthropic-sdk-typescript/issues/185)) ([70257d4](https://github.com/anthropics/anthropic-sdk-typescript/commit/70257d43296f5b448b5649a34b67a3a3a26704ab))


### Refactors

* **streaming:** change Stream constructor signature ([#174](https://github.com/anthropics/anthropic-sdk-typescript/issues/174)) ([1951824](https://github.com/anthropics/anthropic-sdk-typescript/commit/195182432c41a2a8a4fc425788267e60f36f5820))
* **test:** refactor authentication tests ([#176](https://github.com/anthropics/anthropic-sdk-typescript/issues/176)) ([f59daad](https://github.com/anthropics/anthropic-sdk-typescript/commit/f59daad06cab4c5df3068ea7f71ecbb20d8af141))

## 0.6.6 (2023-10-11)

Full Changelog: [v0.6.5...v0.6.6](https://github.com/anthropics/anthropic-sdk-typescript/compare/v0.6.5...v0.6.6)

### Chores

* update README ([#173](https://github.com/anthropics/anthropic-sdk-typescript/issues/173)) ([5f50c1b](https://github.com/anthropics/anthropic-sdk-typescript/commit/5f50c1b2f160610c89f158a10d83029c356d925a))

## 0.6.5 (2023-10-11)

Full Changelog: [v0.6.4...v0.6.5](https://github.com/anthropics/anthropic-sdk-typescript/compare/v0.6.4...v0.6.5)

### Features

* **client:** handle retry-after with a date ([#162](https://github.com/anthropics/anthropic-sdk-typescript/issues/162)) ([31bd609](https://github.com/anthropics/anthropic-sdk-typescript/commit/31bd60905858a6532414665a1368ae9f5fd29370))
* **client:** retry on 408 Request Timeout ([#151](https://github.com/anthropics/anthropic-sdk-typescript/issues/151)) ([3523ffe](https://github.com/anthropics/anthropic-sdk-typescript/commit/3523ffe5647448d5a5960b1339c9a17374e85dd5))
* **client:** support importing node or web shims manually ([#157](https://github.com/anthropics/anthropic-sdk-typescript/issues/157)) ([c1237fe](https://github.com/anthropics/anthropic-sdk-typescript/commit/c1237feaea9ca2d244720f2f75e023450a78019f))
* **errors:** add status code to error message ([#155](https://github.com/anthropics/anthropic-sdk-typescript/issues/155)) ([76cf128](https://github.com/anthropics/anthropic-sdk-typescript/commit/76cf128b68f206038945ac4f54f6f50e8a6a2c1b))
* **package:** export a root error type ([#160](https://github.com/anthropics/anthropic-sdk-typescript/issues/160)) ([51d8d60](https://github.com/anthropics/anthropic-sdk-typescript/commit/51d8d60b72fbe99dcb4d5a9ec32abbcb21ba1460))


### Bug Fixes

* **client:** eliminate circular imports, which cause runtime errors in webpack dev bundles ([#170](https://github.com/anthropics/anthropic-sdk-typescript/issues/170)) ([4a86733](https://github.com/anthropics/anthropic-sdk-typescript/commit/4a86733b9d11349fca041683ac9d89685133557d))
* fix namespace exports regression ([#171](https://github.com/anthropics/anthropic-sdk-typescript/issues/171)) ([0689a91](https://github.com/anthropics/anthropic-sdk-typescript/commit/0689a9196619d968870b7fd2e1a0f037a1aee282))
* prevent ReferenceError, update compatibility to ES2020 and Node 18+ ([#169](https://github.com/anthropics/anthropic-sdk-typescript/issues/169)) ([9753314](https://github.com/anthropics/anthropic-sdk-typescript/commit/9753314b7e36a270bb4c29f2981c521ec9c17773))


### Chores

* **internal:** bump lock file ([#159](https://github.com/anthropics/anthropic-sdk-typescript/issues/159)) ([e6030fa](https://github.com/anthropics/anthropic-sdk-typescript/commit/e6030fa915f26569f9c48c478a5e6c01910a6557))
* **internal:** minor formatting improvement ([#168](https://github.com/anthropics/anthropic-sdk-typescript/issues/168)) ([6447608](https://github.com/anthropics/anthropic-sdk-typescript/commit/644760883802bc2769a916fa477f2c6491f018fd))
* **internal:** update lock file ([#161](https://github.com/anthropics/anthropic-sdk-typescript/issues/161)) ([370ce3c](https://github.com/anthropics/anthropic-sdk-typescript/commit/370ce3c34b87591071fefc8b53977078603b6ca4))
* **internal:** update lock file ([#163](https://github.com/anthropics/anthropic-sdk-typescript/issues/163)) ([4a37181](https://github.com/anthropics/anthropic-sdk-typescript/commit/4a37181e0ceada13e3ed61d6df7aa34492dc57a7))
* **internal:** update lock file ([#164](https://github.com/anthropics/anthropic-sdk-typescript/issues/164)) ([939c155](https://github.com/anthropics/anthropic-sdk-typescript/commit/939c155277e67c19f7b2ff956f7cf0d40d4671cd))


### Documentation

* **api.md:** add shared models ([#158](https://github.com/anthropics/anthropic-sdk-typescript/issues/158)) ([33e5518](https://github.com/anthropics/anthropic-sdk-typescript/commit/33e5518bdeca83bbbde0e144e444609f569f1477))
* declare Bun 1.0 officially supported ([#154](https://github.com/anthropics/anthropic-sdk-typescript/issues/154)) ([429d8f4](https://github.com/anthropics/anthropic-sdk-typescript/commit/429d8f44b113a91599f0ebb69128636da82a5050))
* **readme:** remove incorrect wording in opening ([#156](https://github.com/anthropics/anthropic-sdk-typescript/issues/156)) ([01973fe](https://github.com/anthropics/anthropic-sdk-typescript/commit/01973fe50b13ce2981656f8c13603975e7c43efd))

## 0.6.4 (2023-09-08)

Full Changelog: [v0.6.3...v0.6.4](https://github.com/anthropics/anthropic-sdk-typescript/compare/v0.6.3...v0.6.4)

### Features

* **package:** add Bun export map ([#139](https://github.com/anthropics/anthropic-sdk-typescript/issues/139)) ([ba3310d](https://github.com/anthropics/anthropic-sdk-typescript/commit/ba3310d903cd5fda91168266335f4e445e60cad4))


### Bug Fixes

* **client:** fix TS errors that appear when users Go to Source in VSCode ([#142](https://github.com/anthropics/anthropic-sdk-typescript/issues/142)) ([f7bfbea](https://github.com/anthropics/anthropic-sdk-typescript/commit/f7bfbeaa54d364201bbe5cddf3132875ae2a3ccf))
* **client:** handle case where the client is instantiated with a undefined baseURL ([#143](https://github.com/anthropics/anthropic-sdk-typescript/issues/143)) ([10e5203](https://github.com/anthropics/anthropic-sdk-typescript/commit/10e52034990d90dcdaf26672ea384545b88ddf35))
* **client:** use explicit file extensions in _shims imports ([#141](https://github.com/anthropics/anthropic-sdk-typescript/issues/141)) ([10fd687](https://github.com/anthropics/anthropic-sdk-typescript/commit/10fd68742a202c5c0a8b520db190c239dce9b676))
* fix module not found errors in Vercel edge ([#148](https://github.com/anthropics/anthropic-sdk-typescript/issues/148)) ([72e51a1](https://github.com/anthropics/anthropic-sdk-typescript/commit/72e51a170855281a8d099b00c6fb1e9ccb276212))
* **readme:** update link to api.md to use the correct branch ([#145](https://github.com/anthropics/anthropic-sdk-typescript/issues/145)) ([5db78ed](https://github.com/anthropics/anthropic-sdk-typescript/commit/5db78edec4826f86b2fc21ee3f470b49a4987029))


### Chores

* **internal:** export helper from core ([#147](https://github.com/anthropics/anthropic-sdk-typescript/issues/147)) ([7e79de1](https://github.com/anthropics/anthropic-sdk-typescript/commit/7e79de14edeab8110d740e996653e9f9cc2299a4))


### Documentation

* **readme:** add link to api.md ([#144](https://github.com/anthropics/anthropic-sdk-typescript/issues/144)) ([716c9f0](https://github.com/anthropics/anthropic-sdk-typescript/commit/716c9f0714c0e9c26cb6cdcb007457aff1284cf4))

## 0.6.3 (2023-08-28)

Full Changelog: [v0.6.2...v0.6.3](https://github.com/anthropics/anthropic-sdk-typescript/compare/v0.6.2...v0.6.3)

### Bug Fixes

* **types:** improve getNextPage() return type ([#137](https://github.com/anthropics/anthropic-sdk-typescript/issues/137)) ([713d603](https://github.com/anthropics/anthropic-sdk-typescript/commit/713d6032c2c3b3630314a9625a1672147ef19258))


### Chores

* **ci:** setup workflows to create releases and release PRs ([#135](https://github.com/anthropics/anthropic-sdk-typescript/issues/135)) ([56229d9](https://github.com/anthropics/anthropic-sdk-typescript/commit/56229d964733a8b00625dac4ff138b3ade7e4202))

## [0.6.2](https://github.com/anthropics/anthropic-sdk-typescript/compare/v0.6.1...v0.6.2) (2023-08-26)


### Bug Fixes

* **stream:** declare Stream.controller as public ([#132](https://github.com/anthropics/anthropic-sdk-typescript/issues/132)) ([ff33a89](https://github.com/anthropics/anthropic-sdk-typescript/commit/ff33a893747aa708133bab14e97fba34ec776303))


### Refactors

* remove unnecessary line in constructor ([#131](https://github.com/anthropics/anthropic-sdk-typescript/issues/131)) ([dcdf5e5](https://github.com/anthropics/anthropic-sdk-typescript/commit/dcdf5e5183e99ae91d170ca09cc6da5e5637783f))


### Chores

* **internal:** add helper method ([#133](https://github.com/anthropics/anthropic-sdk-typescript/issues/133)) ([4c6950a](https://github.com/anthropics/anthropic-sdk-typescript/commit/4c6950a489b818151127aa1a39c239e4fd58a06e))
* **internal:** export HeadersInit type shim ([#129](https://github.com/anthropics/anthropic-sdk-typescript/issues/129)) ([bcd51bd](https://github.com/anthropics/anthropic-sdk-typescript/commit/bcd51bd12ad0854baf28b59dcada871889032515))

## [0.6.1](https://github.com/anthropics/anthropic-sdk-typescript/compare/v0.6.0...v0.6.1) (2023-08-23)


### Features

* allow a default timeout to be set for clients ([#113](https://github.com/anthropics/anthropic-sdk-typescript/issues/113)) ([1c5b2e2](https://github.com/anthropics/anthropic-sdk-typescript/commit/1c5b2e29926100a6e4a6176f0943e2c98991175d))
* **client:** improve compatibility with Bun ([#119](https://github.com/anthropics/anthropic-sdk-typescript/issues/119)) ([fe4f5d5](https://github.com/anthropics/anthropic-sdk-typescript/commit/fe4f5d5e35e35cab2a62388eb595519e9c14635c))
* **docs:** add documentation to the client constructor ([#118](https://github.com/anthropics/anthropic-sdk-typescript/issues/118)) ([79303f9](https://github.com/anthropics/anthropic-sdk-typescript/commit/79303f9c46a8248abd05fedbedbbed6e735c046d))
* **types:** export RequestOptions type ([#127](https://github.com/anthropics/anthropic-sdk-typescript/issues/127)) ([9769751](https://github.com/anthropics/anthropic-sdk-typescript/commit/9769751b84853822e3e6596110ecb2c367f07438))
* **types:** remove footgun with streaming params ([#125](https://github.com/anthropics/anthropic-sdk-typescript/issues/125)) ([3ed67b6](https://github.com/anthropics/anthropic-sdk-typescript/commit/3ed67b670bae14bc586df224aa57dd4dfa6e71f5))


### Bug Fixes

* **client:** fix TypeError when a request gets retried ([#117](https://github.com/anthropics/anthropic-sdk-typescript/issues/117)) ([0ade979](https://github.com/anthropics/anthropic-sdk-typescript/commit/0ade979a322c07f9a8f5322407b38352fe99b3ce))
* **core:** fix navigator check for strange environments ([#124](https://github.com/anthropics/anthropic-sdk-typescript/issues/124)) ([c783604](https://github.com/anthropics/anthropic-sdk-typescript/commit/c7836040017d5ce35204c07be0b018e87e827fdb))
* **types:** add catch-all overload to streaming methods ([#123](https://github.com/anthropics/anthropic-sdk-typescript/issues/123)) ([7c229a2](https://github.com/anthropics/anthropic-sdk-typescript/commit/7c229a24e6751bad22acb8c544113713140120fd))


### Documentation

* **readme:** fix typo ([#121](https://github.com/anthropics/anthropic-sdk-typescript/issues/121)) ([c5dbc3f](https://github.com/anthropics/anthropic-sdk-typescript/commit/c5dbc3fe89c84a728b6a4d7a4f6eadb228ac5688))


### Chores

* assign default reviewers to release PRs ([#115](https://github.com/anthropics/anthropic-sdk-typescript/issues/115)) ([1df3965](https://github.com/anthropics/anthropic-sdk-typescript/commit/1df3965a10256d30f8ce2af8d9890a26522117a9))
* **internal:** add missing eslint-plugin-prettier ([#122](https://github.com/anthropics/anthropic-sdk-typescript/issues/122)) ([66bede0](https://github.com/anthropics/anthropic-sdk-typescript/commit/66bede0ae3ed7b5baa002bbb0c87b4156306f982))
* **internal:** fix error happening in CloudFlare pages ([#116](https://github.com/anthropics/anthropic-sdk-typescript/issues/116)) ([b0dc7b3](https://github.com/anthropics/anthropic-sdk-typescript/commit/b0dc7b3b14520ce1f66c2b9d6a0f5aae4028985b))
* **internal:** minor reformatting of code ([#120](https://github.com/anthropics/anthropic-sdk-typescript/issues/120)) ([4bcaf9e](https://github.com/anthropics/anthropic-sdk-typescript/commit/4bcaf9e30a312284cb22c2084e8242ad7d181ba8))

## [0.6.0](https://github.com/anthropics/anthropic-sdk-typescript/compare/v0.5.10...v0.6.0) (2023-08-12)


### Features

* **client:** add support for accessing the raw response object ([#105](https://github.com/anthropics/anthropic-sdk-typescript/issues/105)) ([c86b059](https://github.com/anthropics/anthropic-sdk-typescript/commit/c86b0593a630f3adafc5c329019ea7028b6a41cd))
* **client:** detect browser usage ([#101](https://github.com/anthropics/anthropic-sdk-typescript/issues/101)) ([f4cae3f](https://github.com/anthropics/anthropic-sdk-typescript/commit/f4cae3f63c2e65e087a7bf27dac1eeb8200e0a36))
* **types:** improve streaming params types ([#102](https://github.com/anthropics/anthropic-sdk-typescript/issues/102)) ([cdf808c](https://github.com/anthropics/anthropic-sdk-typescript/commit/cdf808ca2a18cd744a5d1840e5e2adb3015e8d1d))


### Documentation

* **readme:** minor updates ([#107](https://github.com/anthropics/anthropic-sdk-typescript/issues/107)) ([406fd97](https://github.com/anthropics/anthropic-sdk-typescript/commit/406fd97d4cee0dd363ad548c9a251f78091a70e3))
* **readme:** remove beta status + document versioning policy ([#100](https://github.com/anthropics/anthropic-sdk-typescript/issues/100)) ([e9ef3d2](https://github.com/anthropics/anthropic-sdk-typescript/commit/e9ef3d21a25e355d8bf94b7a941ad82ec5eafec8))


### Chores

* **docs:** remove trailing spaces ([#108](https://github.com/anthropics/anthropic-sdk-typescript/issues/108)) ([4ba2c6f](https://github.com/anthropics/anthropic-sdk-typescript/commit/4ba2c6f181521ed9a60ed45c35d2276129cd7a0b))
* **internal:** conditionally include bin during build output ([#109](https://github.com/anthropics/anthropic-sdk-typescript/issues/109)) ([58ac305](https://github.com/anthropics/anthropic-sdk-typescript/commit/58ac305d752d6b5c378f91b988ddfb97231c003c))
* **internal:** fix deno build ([#98](https://github.com/anthropics/anthropic-sdk-typescript/issues/98)) ([f011e04](https://github.com/anthropics/anthropic-sdk-typescript/commit/f011e041f2f9cabb12951013825c0f0a2a569053))
* **internal:** remove deno build ([#103](https://github.com/anthropics/anthropic-sdk-typescript/issues/103)) ([9af1527](https://github.com/anthropics/anthropic-sdk-typescript/commit/9af152707a9bcf3027afc64f027566be25da2eb9))


### Refactors

* **client:** remove Stream.toReadableStream() ([#110](https://github.com/anthropics/anthropic-sdk-typescript/issues/110)) ([c370412](https://github.com/anthropics/anthropic-sdk-typescript/commit/c37041285ed9cccf6d980a953e14ffd4006a8acc))

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
