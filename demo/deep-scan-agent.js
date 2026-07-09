/* eslint-disable @typescript-eslint/no-require-imports */
const {
  WatchTowerClient,
  WatchTowerPaymentFundingError,
  WatchTowerPaymentRequiredError,
} = require("../packages/watchtower-sdk/src/index.js");
const { createAgentConfig } = require("./watchtower-demo-config.js");

// WETH on Ethereum mainnet. This blue-chip ERC-20 has strong coverage across
// DexScreener liquidity/social data, GoPlus contract analysis, and Ethplorer holders.
const targetToken = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const targetChainId = "1";

async function runDeepScan() {
  const agentConfig = await createAgentConfig();
  const watchTower = new WatchTowerClient(agentConfig);

  console.log("🔍 Initializing WatchTower Deep Scan (Tier 1)...");
  console.log(`👛 Agent wallet: ${agentConfig.agentWallet}`);
  console.log("💸 WatchTower will settle the x402 payment automatically if required.");

  try {
    const report = await watchTower.deepScan(targetToken, { chainId: targetChainId });

    console.log(`\n======================================================`);
    console.log(`✅ DEEP SCAN COMPLETE`);
    console.log(`======================================================`);
    console.log(`Target Address : ${report.tokenAddress}`);
    console.log(`Chain ID       : ${report.chainId}`);
    console.log(`Verdict        : ${report.verdict.recommendation}`);
    console.log(`Threat Score   : ${report.verdict.threatScore}/100`);
    console.log(`Confidence     : ${(report.verdict.confidence * 100).toFixed(0)}%`);

    console.log(`\nIntelligence Breakdown:`);
    for (const mod of report.intelligenceModules) {
      const status = mod.status === 'coming_soon' ? ' [Coming Soon]' : '';
      console.log(`  ► ${mod.name}${status} (${mod.score}/${mod.maxScore})`);
      for (const signal of mod.signals) {
        console.log(`      - ${signal}`);
      }
    }

    console.log(`\nRecommendations:`);
    for (const recommendation of report.recommendations) {
      console.log(`  - ${recommendation}`);
    }

    console.log(`\n======================================================`);
    console.log(`💎 PREMIUM REPORT GENERATED`);
    console.log(`======================================================`);
    console.log(`Scan Hash      : ${report.verification.scanHash}`);
    console.log(`Registry Tx    : ${report.verification.txHash || 'not recorded'}`);
    console.log(`View report    : ${agentConfig.apiUrl}/report/${report.verification.scanHash}\n`);
  } catch (err) {
    if (err instanceof WatchTowerPaymentFundingError || err instanceof WatchTowerPaymentRequiredError) {
      console.error("\n❌ WatchTower payment could not be completed automatically:");
      console.error(err.message);
      process.exit(1);
    }

    console.error("Error running WatchTower Deep Scan:", err.message);
    process.exit(1);
  }
}

runDeepScan().catch((err) => {
  console.error("\n❌ Demo configuration error:", err.message);
  process.exit(1);
});
