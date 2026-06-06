#!/usr/bin/env -S npm run tsn -T
/**
 * Example: verify agent trust before taking action
 *
 * Uses the TWZRD Agent Intel MCP server (https://intel.twzrd.xyz) to score
 * an AI agent wallet before allowing it to proceed. The server exposes:
 *   - score_agent(wallet)       - free trust score (0-100)
 *   - preflight_check(wallet)   - free pass/fail gate
 *   - get_trust_receipt(wallet) - paid x402 on-chain receipt
 *
 * Run:
 *   ANTHROPIC_API_KEY=sk-... yarn tsn -T examples/mcp-agent-trust.ts
 */

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY from env

const AGENT_WALLET = "D1QkbFJKiPsymJ65RKHhF6DFB8sPMfpBaFBzuHKfJGWi"; // example wallet

const main = async () => {
  const stream = anthropic.beta.messages.stream(
    {
      model: "claude-opus-4-5",
      max_tokens: 512,
      mcp_servers: [
        {
          type: "url",
          url: "https://intel.twzrd.xyz/mcp",
          name: "twzrd-agent-intel",
          // No auth token needed — score_agent and preflight_check are free
        },
      ],
      messages: [
        {
          role: "user",
          content: `Use the twzrd-agent-intel MCP server to run preflight_check for wallet ${AGENT_WALLET}. If the check passes, confirm the agent is trusted. If it fails, explain why the agent should be blocked.`,
        },
      ],
    },
    {
      headers: {
        "anthropic-beta": "mcp-client-2025-04-04",
      },
    },
  );

  process.stdout.write("\nAgent trust check result:\n");
  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      process.stdout.write(event.delta.text);
    }
  }
  process.stdout.write("\n");
};

main();
