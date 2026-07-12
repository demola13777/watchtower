import nextEnv from '@next/env';

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const API_URL = 'http://localhost:3000'; // Run against local to avoid Vercel 500 error
const AGENT_WALLET = process.env.AGENT_PAYMENT_ADDRESS;

console.log('Resume payment helper');
console.log(`API_URL=${API_URL}`);
console.log(`AGENT_WALLET=${AGENT_WALLET || '<unset>'}`);
console.log('Provide the original paymentId and settlement transaction hash to retry the exact paid request.');
