// demo/rogue-agent.js
const targetToken = "0x2498a8fDa4F689c2A4a86767468Ff24dEab24e3D";

console.log("🚀 Starting Unprotected Trading Agent...");
console.log("📡 Listening for new token pairs on Dex...");

setTimeout(() => {
  console.log(`\n======================================================`);
  console.log(`⚠️  NEW PAIR DETECTED`);
  console.log(`======================================================`);
  console.log(`Target Address : ${targetToken}`);
  console.log(`Action         : BUY (1.5 ETH)`);
  console.log(`\n✅ Transaction submitted to mempool...`);

  setTimeout(() => {
    console.log(`\n======================================================`);
    console.log(`💥 FATAL REVERT: EXECUTION FAILED`);
    console.log(`======================================================`);
    console.log(`  ❌ ALARM: Token volume is dead. Liquidity pulled.`);
    console.log(`  ❌ ERROR: Unable to sell. No liquidity remaining.`);
    console.log(`\n💀 Agent wallet fully drained.\n`);
    process.exit(1);
  }, 1500);
}, 2000);
