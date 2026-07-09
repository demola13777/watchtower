// eslint-disable-next-line @typescript-eslint/no-require-imports
const { WatchTowerClient, WatchTowerAbortError } = require("../packages/watchtower-sdk/src/index.js");

// Initialize WatchTower with a configurable threshold.
// An arbitrage bot might set threshold: 40 (very cautious).
// A yield optimizer might set threshold: 80 (more tolerant).
const watchTower = new WatchTowerClient({
  apiUrl: "http://localhost:3000",
  agentWallet: "0x0000000000000000000000000000000000000A99",
  chainId: "1952",
  threshold: 60, // Block anything above 60
});

// Demo DEX event: a new token pair was just created.
const NEW_TOKEN_EVENT = {
  tokenAddress: '0x2498a8fDa4F689c2A4a86767468Ff24dEab24e3D', // Live MaliciousRugPull on X Layer Testnet
  pairName: 'TRAP/WETH',
};

// The dead token from our tests
const targetToken = NEW_TOKEN_EVENT.tokenAddress;

console.log("🚀 Starting Protected Trading Agent with WatchTower SDK...");
console.log(`🔧 Kill Switch threshold: 60/100`);
console.log("📡 Listening for new token pairs on Dex...");

setTimeout(async () => {
  console.log(`\n⚠️  NEW PAIR DETECTED: ${targetToken}`);
  console.log("🛡️  Passing transaction through WatchTower Middleware...\n");

  try {
    const safeTx = await watchTower.guardTransaction(targetToken, "1952");

    console.log(`\n======================================================`);
    console.log(`✅ WATCHTOWER CLEAR`);
    console.log(`======================================================`);
    console.log(`Threat Score : ${safeTx.threatScore}/100`);
    console.log(`Confidence   : ${(safeTx.confidence * 100).toFixed(0)}%`);
    console.log(`On-chain Hash: ${safeTx.scanHash.substring(0, 16)}...`);

    if (safeTx.modules) {
      console.log("\nIntelligence Breakdown:");
      for (const mod of safeTx.modules) {
        const status = mod.status === 'coming_soon' ? ' [Coming Soon]' : '';
        console.log(`  ► ${mod.name}${status} (${mod.score}/${mod.maxScore})`);
        for (const s of mod.signals) {
          console.log(`      - ${s}`);
        }
      }
    }
    console.log(`======================================================`);
    console.log(`🚀 Executing trade...`);

    process.exit(0);
  } catch (err) {
    if (err instanceof WatchTowerAbortError) {
      console.log(`\n======================================================`);
      console.log(`🛑 WATCHTOWER OVERRIDE: TRANSACTION ABORTED`);
      console.log(`======================================================`);
      console.log(`Threat Score : ${err.threatScore}/100`);
      console.log(`Confidence   : ${(err.confidence * 100).toFixed(0)}%`);
      console.log(`\nCritical Flags Detected:`);
      
      err.reasoning.forEach(reason => {
        // Clean up the "[Module Name]" prefix if it exists to make it prettier
        const cleanReason = reason.replace(/^\[.*?\]\s*/, '');
        console.log(`  ❌ ${cleanReason}`);
      });

      console.log(`======================================================`);
      console.log(`💰 Funds protected. The agent avoided a total loss.\n`);
      process.exit(0);
    } else {
      console.error("\n❌ Unknown Error:", err);
      process.exit(1);
    }
  }
}, 2000);
