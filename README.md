# Anthropic TypeScript SDK [![npm](https://img.shields.io/npm/v/@anthropic-ai/sdk)](https://www.npmjs.com/package/@anthropic-ai/sdk)

This package provides access to Anthropic's safety-first language model APIs.

For more information on our APIs, please check the confidential documentation portal.

**Note that this package only officially supports Node 16+.**

## Installation

Install using your package manager of choice. For example:

```sh
npm install @anthropic-ai/sdk
```

… or:

```sh
yarn add @anthropic-ai/sdk
```

## Development and testing

Examples are available in the [examples/](examples/) folder.

To get started, install dependencies, set your API key, and run one of the [package.json](package.json) scripts:

```sh
yarn
export ANTHROPIC_API_KEY=<insert token here>
yarn example:basic_stream
yarn example:basic_sync
```
