# Changelog

## 0.7.0 (2025-01-21)

Full Changelog: [vertex-sdk-v0.6.3...vertex-sdk-v0.7.0](https://github.com/anthropics/anthropic-sdk-typescript/compare/vertex-sdk-v0.6.3...vertex-sdk-v0.7.0)

### ⚠ BREAKING CHANGES

* **api:** messages is generally available ([#287](https://github.com/anthropics/anthropic-sdk-typescript/issues/287))

### Features

* **api:** messages is generally available ([#287](https://github.com/anthropics/anthropic-sdk-typescript/issues/287)) ([57b7135](https://github.com/anthropics/anthropic-sdk-typescript/commit/57b713508614e9d125c22d64c4c5fabaa7c75ad8))
* **vertex:** add beta.messages.create() ([08a8928](https://github.com/anthropics/anthropic-sdk-typescript/commit/08a8928fb1fa701f4330720ea2e9d4db81b6b17a))
* **vertex:** add support for google vertex ([#265](https://github.com/anthropics/anthropic-sdk-typescript/issues/265)) ([96f9b55](https://github.com/anthropics/anthropic-sdk-typescript/commit/96f9b55feb9059184a2a1c0ec52c5f8dad862a32))
* **vertex:** add support for overriding google auth ([#338](https://github.com/anthropics/anthropic-sdk-typescript/issues/338)) ([f268237](https://github.com/anthropics/anthropic-sdk-typescript/commit/f26823762219f78dce487165331312612c4399b9))
* **vertex:** api is no longer in private beta ([#344](https://github.com/anthropics/anthropic-sdk-typescript/issues/344)) ([a151de7](https://github.com/anthropics/anthropic-sdk-typescript/commit/a151de7a9416b899a4eb22b21978f2b03f087396))
* **vertex:** support token counting ([a4a3729](https://github.com/anthropics/anthropic-sdk-typescript/commit/a4a372947b250e195f5c45ffd928a2d966b23f0d))
* **vertex:** support tools ([d9e9e3c](https://github.com/anthropics/anthropic-sdk-typescript/commit/d9e9e3c789d9a90c247bdade764d60e9fd8a8add))


### Bug Fixes

* **types:** correctly mark type as a required property in requests ([#371](https://github.com/anthropics/anthropic-sdk-typescript/issues/371)) ([06fc0f7](https://github.com/anthropics/anthropic-sdk-typescript/commit/06fc0f74f7769628f4001b9b739c463cd84e7e6f))
* **vertex:** add beta.messages.countTokens method ([2cbeabc](https://github.com/anthropics/anthropic-sdk-typescript/commit/2cbeabc6f0175297c98b5d706a0038d793150e8e))
* **vertex:** correct core client dependency constraint ([#384](https://github.com/anthropics/anthropic-sdk-typescript/issues/384)) ([10b9334](https://github.com/anthropics/anthropic-sdk-typescript/commit/10b93342c4b18a43797f078b66164fa31314334b))
* **vertex:** correct messages beta handling ([a41193d](https://github.com/anthropics/anthropic-sdk-typescript/commit/a41193d112f47faaae88872e8764b631dbad1941))
* **vertex:** don't mutate request body inputs ([2709c1f](https://github.com/anthropics/anthropic-sdk-typescript/commit/2709c1fb255282321fab296e709651a79017fe37))
* **vertex:** remove `anthropic_version` deletion for token counting ([beefeb7](https://github.com/anthropics/anthropic-sdk-typescript/commit/beefeb74060196c564de14ddb6a39734f7b0352e))


### Chores

* **bedrock,vertex:** remove unsupported countTokens method ([#597](https://github.com/anthropics/anthropic-sdk-typescript/issues/597)) ([6f6db16](https://github.com/anthropics/anthropic-sdk-typescript/commit/6f6db164d2526c2fb272151f4d68140da27ce1ea))
* **deps:** remove unused dependency digest-fetch ([#368](https://github.com/anthropics/anthropic-sdk-typescript/issues/368)) ([62790cb](https://github.com/anthropics/anthropic-sdk-typescript/commit/62790cb93abd27d63c2d6678159803972dc20606))
* **internal:** don't re-export streaming type ([#267](https://github.com/anthropics/anthropic-sdk-typescript/issues/267)) ([a5b0ab1](https://github.com/anthropics/anthropic-sdk-typescript/commit/a5b0ab18f4959e8cd28c7aab07509a3431180ab2))
* **internal:** fix generated version numbers ([#413](https://github.com/anthropics/anthropic-sdk-typescript/issues/413)) ([471430d](https://github.com/anthropics/anthropic-sdk-typescript/commit/471430dc1bfc7317b737bf778bda45aa591b087e))
* **internal:** refactor scripts ([#404](https://github.com/anthropics/anthropic-sdk-typescript/issues/404)) ([60d1d00](https://github.com/anthropics/anthropic-sdk-typescript/commit/60d1d0035cb066a244f36f384f9d2f828d7c8de6))
* **internal:** remove old reference to check-test-server ([e31a467](https://github.com/anthropics/anthropic-sdk-typescript/commit/e31a467163d801f1af1f25e967bdab226f5942ac))
* **internal:** temporary revert commit ([#643](https://github.com/anthropics/anthropic-sdk-typescript/issues/643)) ([5e992e1](https://github.com/anthropics/anthropic-sdk-typescript/commit/5e992e1a9f75eceb948242498b6818d9af89a60e))
* **internal:** update lock files ([#377](https://github.com/anthropics/anthropic-sdk-typescript/issues/377)) ([0029ce4](https://github.com/anthropics/anthropic-sdk-typescript/commit/0029ce4c4516e22a970d67d211d37e95519b2786))
* **internal:** update release-please config ([#269](https://github.com/anthropics/anthropic-sdk-typescript/issues/269)) ([74719fc](https://github.com/anthropics/anthropic-sdk-typescript/commit/74719fc4321aadd7c4622458623073cd3adad8e8))


### Documentation

* **readme:** mention tool use ([#375](https://github.com/anthropics/anthropic-sdk-typescript/issues/375)) ([c08bdd4](https://github.com/anthropics/anthropic-sdk-typescript/commit/c08bdd4b91078ef9d18191771fbd300edb599fe7))
* remove extraneous --save and yarn install instructions ([#323](https://github.com/anthropics/anthropic-sdk-typescript/issues/323)) ([57f8656](https://github.com/anthropics/anthropic-sdk-typescript/commit/57f8656d9b61c334e2f1ac7ff7cce118bc4bf46d))
* update models in vertex examples ([#331](https://github.com/anthropics/anthropic-sdk-typescript/issues/331)) ([0e1b5c0](https://github.com/anthropics/anthropic-sdk-typescript/commit/0e1b5c0f79f02dd12a69778609b0857bd47dadcd))
* use latest sonnet in example snippets ([#625](https://github.com/anthropics/anthropic-sdk-typescript/issues/625)) ([a965791](https://github.com/anthropics/anthropic-sdk-typescript/commit/a9657918aaf1246609105cbafaf4bb043b146356))

## 0.6.3 (2025-01-21)

Full Changelog: [vertex-sdk-v0.6.2...vertex-sdk-v0.6.3](https://github.com/anthropics/anthropic-sdk-typescript/compare/vertex-sdk-v0.6.2...vertex-sdk-v0.6.3)

### Bug Fixes

* **vertex:** add beta.messages.countTokens method ([51d3f23](https://github.com/anthropics/anthropic-sdk-typescript/commit/51d3f23a7cc1bea798cc8e4041e08114ebc3a4eb))


### Chores

* **internal:** temporary revert commit ([#643](https://github.com/anthropics/anthropic-sdk-typescript/issues/643)) ([43dd43c](https://github.com/anthropics/anthropic-sdk-typescript/commit/43dd43c4c8ab69d5a60e59473af7dff5f7799048))

## 0.6.2 (2024-12-20)

Full Changelog: [vertex-sdk-v0.6.1...vertex-sdk-v0.6.2](https://github.com/anthropics/anthropic-sdk-typescript/compare/vertex-sdk-v0.6.1...vertex-sdk-v0.6.2)

### Chores

* **internal:** temporary revert commit ([#643](https://github.com/anthropics/anthropic-sdk-typescript/issues/643)) ([8057b1e](https://github.com/anthropics/anthropic-sdk-typescript/commit/8057b1eb67ccccee042a45f2efe53cccced15682))

## 0.6.1 (2024-12-17)

Full Changelog: [vertex-sdk-v0.6.0...vertex-sdk-v0.6.1](https://github.com/anthropics/anthropic-sdk-typescript/compare/vertex-sdk-v0.6.0...vertex-sdk-v0.6.1)

### Bug Fixes

* **vertex:** remove `anthropic_version` deletion for token counting ([88221be](https://github.com/anthropics/anthropic-sdk-typescript/commit/88221be305d6e13ccf92e6e9cdb00daba45b57db))

## 0.6.0 (2024-12-17)

Full Changelog: [vertex-sdk-v0.5.2...vertex-sdk-v0.6.0](https://github.com/anthropics/anthropic-sdk-typescript/compare/vertex-sdk-v0.5.2...vertex-sdk-v0.6.0)

### Features

* **api:** general availability updates ([#631](https://github.com/anthropics/anthropic-sdk-typescript/issues/631)) ([b5c92e5](https://github.com/anthropics/anthropic-sdk-typescript/commit/b5c92e5b74c370ac3f9ba28e915bd54588a42be0))
* **vertex:** support token counting ([9e76b4d](https://github.com/anthropics/anthropic-sdk-typescript/commit/9e76b4dc22d62b1239b382bb771b69ad8cff9442))


### Chores

* **bedrock,vertex:** remove unsupported countTokens method ([#597](https://github.com/anthropics/anthropic-sdk-typescript/issues/597)) ([17b7da5](https://github.com/anthropics/anthropic-sdk-typescript/commit/17b7da5ee6f35ea2bdd53a66a662871affae6341))


### Documentation

* use latest sonnet in example snippets ([#625](https://github.com/anthropics/anthropic-sdk-typescript/issues/625)) ([f70882b](https://github.com/anthropics/anthropic-sdk-typescript/commit/f70882b0e8119a414b01b9f0b85fbe1ccb06f122))

## 0.5.2 (2024-11-05)

Full Changelog: [vertex-sdk-v0.5.1...vertex-sdk-v0.5.2](https://github.com/anthropics/anthropic-sdk-typescript/compare/vertex-sdk-v0.5.1...vertex-sdk-v0.5.2)

### Bug Fixes

* **vertex:** don't mutate request body inputs ([e9a82e5](https://github.com/anthropics/anthropic-sdk-typescript/commit/e9a82e56f0d7fff956c2ebd19e103a190f8beb83))

## 0.5.1 (2024-10-23)

Full Changelog: [vertex-sdk-v0.5.0...vertex-sdk-v0.5.1](https://github.com/anthropics/anthropic-sdk-typescript/compare/vertex-sdk-v0.5.0...vertex-sdk-v0.5.1)

### Bug Fixes

* **vertex:** correct messages beta handling ([26f21ee](https://github.com/anthropics/anthropic-sdk-typescript/commit/26f21ee5f524f4cbfb7a97d40aa62553608b1d99))

## 0.5.0 (2024-10-22)

Full Changelog: [vertex-sdk-v0.4.3...vertex-sdk-v0.5.0](https://github.com/anthropics/anthropic-sdk-typescript/compare/vertex-sdk-v0.4.3...vertex-sdk-v0.5.0)

### Features

* **vertex:** add beta.messages.create() ([22cfdba](https://github.com/anthropics/anthropic-sdk-typescript/commit/22cfdba2a3a54e916f2efcbce62990544d3e5f5f))

## 0.4.3 (2024-10-08)

Full Changelog: [vertex-sdk-v0.4.2...vertex-sdk-v0.4.3](https://github.com/anthropics/anthropic-sdk-typescript/compare/vertex-sdk-v0.4.2...vertex-sdk-v0.4.3)

### Refactors

* **types:** improve metadata type names ([#547](https://github.com/anthropics/anthropic-sdk-typescript/issues/547)) ([cef499c](https://github.com/anthropics/anthropic-sdk-typescript/commit/cef499cf3b01643f7e5e3c09524f49e198b940be))

## 0.4.2 (2024-10-04)

Full Changelog: [vertex-sdk-v0.4.1...vertex-sdk-v0.4.2](https://github.com/anthropics/anthropic-sdk-typescript/compare/vertex-sdk-v0.4.1...vertex-sdk-v0.4.2)

### Chores

* better object fallback behaviour for casting errors ([#526](https://github.com/anthropics/anthropic-sdk-typescript/issues/526)) ([4ffb2e4](https://github.com/anthropics/anthropic-sdk-typescript/commit/4ffb2e4e1f5fef3ae58d9f4c99a63e75dd459c5b))

## 0.4.1 (2024-07-29)

Full Changelog: [vertex-sdk-v0.4.0...vertex-sdk-v0.4.1](https://github.com/anthropics/anthropic-sdk-typescript/compare/vertex-sdk-v0.4.0...vertex-sdk-v0.4.1)

### Chores

* **internal:** remove old reference to check-test-server ([8dc9afc](https://github.com/anthropics/anthropic-sdk-typescript/commit/8dc9afcf00c4a38c2d85171ebceafc5f6a47c117))

## 0.4.0 (2024-05-30)

Full Changelog: [vertex-sdk-v0.3.7...vertex-sdk-v0.4.0](https://github.com/anthropics/anthropic-sdk-typescript/compare/vertex-sdk-v0.3.7...vertex-sdk-v0.4.0)

### Features

* **vertex:** support tools ([acf0aa7](https://github.com/anthropics/anthropic-sdk-typescript/commit/acf0aa7571425c8582740616e24883c2ec65218b))

## 0.3.7 (2024-05-16)

Full Changelog: [vertex-sdk-v0.3.6...vertex-sdk-v0.3.7](https://github.com/anthropics/anthropic-sdk-typescript/compare/vertex-sdk-v0.3.6...vertex-sdk-v0.3.7)

### Chores

* **internal:** fix generated version numbers ([#413](https://github.com/anthropics/anthropic-sdk-typescript/issues/413)) ([ea77063](https://github.com/anthropics/anthropic-sdk-typescript/commit/ea770630897bb85caaecd39bccf478e4dd3f169c))

## 0.3.6 (2024-05-07)

Full Changelog: [vertex-sdk-v0.3.5...vertex-sdk-v0.3.6](https://github.com/anthropics/anthropic-sdk-typescript/compare/vertex-sdk-v0.3.5...vertex-sdk-v0.3.6)

### Chores

* **internal:** refactor scripts ([#404](https://github.com/anthropics/anthropic-sdk-typescript/issues/404)) ([f60e2d8](https://github.com/anthropics/anthropic-sdk-typescript/commit/f60e2d81bb241063507d2d7e728c78e78c1c5e51))

## 0.3.5 (2024-04-10)

Full Changelog: [vertex-sdk-v0.3.4...vertex-sdk-v0.3.5](https://github.com/anthropics/anthropic-sdk-typescript/compare/vertex-sdk-v0.3.4...vertex-sdk-v0.3.5)

### Bug Fixes

* **vertex:** correct core client dependency constraint ([#384](https://github.com/anthropics/anthropic-sdk-typescript/issues/384)) ([de29699](https://github.com/anthropics/anthropic-sdk-typescript/commit/de2969902b68b5c46b6e682b8b947426c6ccf195))

## 0.3.4 (2024-04-09)

Full Changelog: [vertex-sdk-v0.3.3...vertex-sdk-v0.3.4](https://github.com/anthropics/anthropic-sdk-typescript/compare/vertex-sdk-v0.3.3...vertex-sdk-v0.3.4)

### Chores

* **internal:** update lock files ([#377](https://github.com/anthropics/anthropic-sdk-typescript/issues/377)) ([6d239ef](https://github.com/anthropics/anthropic-sdk-typescript/commit/6d239efaca730baba374a1b49f6b1a4037b3e163))

## 0.3.3 (2024-04-04)

Full Changelog: [vertex-sdk-v0.3.2...vertex-sdk-v0.3.3](https://github.com/anthropics/anthropic-sdk-typescript/compare/vertex-sdk-v0.3.2...vertex-sdk-v0.3.3)

### Documentation

* **readme:** mention tool use ([#375](https://github.com/anthropics/anthropic-sdk-typescript/issues/375)) ([72356dd](https://github.com/anthropics/anthropic-sdk-typescript/commit/72356dd9c498344074c292ffdab602d54c4fa13e))

## 0.3.2 (2024-04-04)

Full Changelog: [vertex-sdk-v0.3.1...vertex-sdk-v0.3.2](https://github.com/anthropics/anthropic-sdk-typescript/compare/vertex-sdk-v0.3.1...vertex-sdk-v0.3.2)

### Bug Fixes

* **types:** correctly mark type as a required property in requests ([#371](https://github.com/anthropics/anthropic-sdk-typescript/issues/371)) ([a04edd8](https://github.com/anthropics/anthropic-sdk-typescript/commit/a04edd8d7f4c552281b37a44099edf432d7fcb27))

## 0.3.1 (2024-04-04)

Full Changelog: [vertex-sdk-v0.3.0...vertex-sdk-v0.3.1](https://github.com/anthropics/anthropic-sdk-typescript/compare/vertex-sdk-v0.3.0...vertex-sdk-v0.3.1)

### Chores

* **deps:** remove unused dependency digest-fetch ([#368](https://github.com/anthropics/anthropic-sdk-typescript/issues/368)) ([df1df0f](https://github.com/anthropics/anthropic-sdk-typescript/commit/df1df0f509682841c703fa1ea5062a796cfe2091))

## 0.3.0 (2024-03-19)

Full Changelog: [vertex-sdk-v0.2.2...vertex-sdk-v0.3.0](https://github.com/anthropics/anthropic-sdk-typescript/compare/vertex-sdk-v0.2.2...vertex-sdk-v0.3.0)

### Features

* **vertex:** add support for overriding google auth ([#338](https://github.com/anthropics/anthropic-sdk-typescript/issues/338)) ([28d98c4](https://github.com/anthropics/anthropic-sdk-typescript/commit/28d98c487257a3c6b3c6d84597768d484fadb86d))
* **vertex:** api is no longer in private beta ([#344](https://github.com/anthropics/anthropic-sdk-typescript/issues/344)) ([892127c](https://github.com/anthropics/anthropic-sdk-typescript/commit/892127cdac059eee11c1a322a5512f9250868023))

## 0.2.2 (2024-03-13)

Full Changelog: [vertex-sdk-v0.2.1...vertex-sdk-v0.2.2](https://github.com/anthropics/anthropic-sdk-typescript/compare/vertex-sdk-v0.2.1...vertex-sdk-v0.2.2)

### Documentation

* update models in vertex examples ([#331](https://github.com/anthropics/anthropic-sdk-typescript/issues/331)) ([3d139b3](https://github.com/anthropics/anthropic-sdk-typescript/commit/3d139b374179ef5540a8e9436df06501c6ada6c5))

## 0.2.1 (2024-03-06)

Full Changelog: [vertex-sdk-v0.2.0...vertex-sdk-v0.2.1](https://github.com/anthropics/anthropic-sdk-typescript/compare/vertex-sdk-v0.2.0...vertex-sdk-v0.2.1)

### Documentation

* remove extraneous --save and yarn install instructions ([#323](https://github.com/anthropics/anthropic-sdk-typescript/issues/323)) ([775ecb9](https://github.com/anthropics/anthropic-sdk-typescript/commit/775ecb9ef3ab17e88dabc149faa0876cd6ab5f0b))

## 0.2.0 (2024-02-13)

Full Changelog: [vertex-sdk-v0.1.2...vertex-sdk-v0.2.0](https://github.com/anthropics/anthropic-sdk-typescript/compare/vertex-sdk-v0.1.2...vertex-sdk-v0.2.0)

### ⚠ BREAKING CHANGES

* **api:** messages is generally available ([#287](https://github.com/anthropics/anthropic-sdk-typescript/issues/287))

### Features

* **api:** messages is generally available ([#287](https://github.com/anthropics/anthropic-sdk-typescript/issues/287)) ([be0a828](https://github.com/anthropics/anthropic-sdk-typescript/commit/be0a82883cf9b1b9d2944525b86e40f2b42cea4f))

## 0.1.2 (2024-01-31)

Full Changelog: [vertex-sdk-v0.1.1...vertex-sdk-v0.1.2](https://github.com/anthropics/anthropic-sdk-typescript/compare/vertex-sdk-v0.1.1...vertex-sdk-v0.1.2)

### Chores

* release main ([e77e068](https://github.com/anthropics/anthropic-sdk-typescript/commit/e77e0683769ae18084ecda178fb9eb85fc47eb4a))

## 0.1.1 (2024-01-25)

Full Changelog: [vertex-sdk-v0.1.0...vertex-sdk-v0.1.1](https://github.com/anthropics/anthropic-sdk-typescript/compare/vertex-sdk-v0.1.0...vertex-sdk-v0.1.1)

### Chores

* **internal:** don't re-export streaming type ([#267](https://github.com/anthropics/anthropic-sdk-typescript/issues/267)) ([bcae5a9](https://github.com/anthropics/anthropic-sdk-typescript/commit/bcae5a95078dfe091d01823cd38cf3c63d28026d))
* **internal:** update release-please config ([#269](https://github.com/anthropics/anthropic-sdk-typescript/issues/269)) ([80952e6](https://github.com/anthropics/anthropic-sdk-typescript/commit/80952e6ff6aea24ade9ea45dcbe8bb61da385304))

## 0.1.0 (2024-01-23)

Full Changelog: [vertex-sdk-v0.0.1...vertex-sdk-v0.1.0](https://github.com/anthropics/anthropic-sdk-typescript/compare/vertex-sdk-v0.0.1...vertex-sdk-v0.1.0)

### Features

* **vertex:** add support for google vertex ([#265](https://github.com/anthropics/anthropic-sdk-typescript/issues/265)) ([9a0410d](https://github.com/anthropics/anthropic-sdk-typescript/commit/9a0410d4e870d796b7def0a6a241e9d409e97886))
