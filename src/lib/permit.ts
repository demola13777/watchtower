/**
 * Execution Authorization — backend wrapper
 *
 * Policy remains local to WatchTower, while permit construction, signing,
 * hashing, and verification are delegated to the canonical SDK permit module.
 */

import crypto from 'crypto';
import { REGISTRY_ADDRESS, REGISTRY_CHAIN_ID } from '@/lib/config';
import type { ThreatReport } from '@/lib/engine';
import {
  createExecutionHash,
  hashCalldata,
  createPermitDigest,
  createPermitDomain,
  signExecutionAuthorization,
  verifyExecutionAuthorization as verifyCanonicalExecutionAuthorization,
  ZERO_ADDRESS,
  type AuthorizationDecision,
  type AuthorizationVerdict,
  type AuthorizationVerification,
  type ExecutionAuthorization,
  type ExecutionIntentInput,
} from '../../packages/watchtower-sdk/src/permit.js';

export type {
  AuthorizationDecision,
  AuthorizationVerdict,
  AuthorizationVerification,
  ExecutionAuthorization,
  ExecutionIntentInput,
};

export interface AuthorizationResult {
  decision: AuthorizationDecision;
  verdict: AuthorizationVerdict;
  riskScore: number;
  confidence: number;
  reasoning: string[];
  authorization: ExecutionAuthorization | null;
  verification: AuthorizationVerification | null;
  attestation: {
    status: 'pending' | 'confirmed' | 'failed';
    permitHash: string;
    txHash?: string | null;
    chain?: string;
    reason?: string;
  } | null;
  scan: {
    analysisHash?: string;
    scanHash: string;
    reportHash?: string;
    permitHash?: string | null;
    reportUrl: string;
  };
  report: unknown;
}

export class AuthorizationPermitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthorizationPermitError';
  }
}

const PERMIT_TTL_MS = 5 * 60 * 1000;

export function evaluatePolicy(report: ThreatReport): {
  decision: AuthorizationDecision;
  verdict: AuthorizationVerdict;
} {
  if (report.recommendation === 'ABORT') {
    return { decision: 'DENIED', verdict: 'ABORT' };
  }

  if (report.recommendation === 'CAUTION') {
    return { decision: 'REVIEW_REQUIRED', verdict: 'REVIEW' };
  }

  return { decision: 'AUTHORIZED', verdict: 'EXECUTE' };
}

export async function generateExecutionAuthorization(input: ExecutionIntentInput & {
  riskScore: number;
}): Promise<ExecutionAuthorization> {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new AuthorizationPermitError('WatchTower signer is not configured. Execution authorization cannot be issued.');
  }
  if (!REGISTRY_ADDRESS) {
    throw new AuthorizationPermitError('WatchTower registry address is not configured. Execution authorization cannot be issued.');
  }

  const { privateKeyToAccount } = await import('viem/accounts');
  const account = privateKeyToAccount(
    privateKey.startsWith('0x') ? privateKey as `0x${string}` : `0x${privateKey}` as `0x${string}`,
  );
  const now = Date.now();
  const executionHash = await createExecutionHash(input);
  const calldataHash = input.calldata ? await hashCalldata(input.calldata) : undefined;

  const unsigned: Omit<ExecutionAuthorization, 'signature'> = {
    id: `permit_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`,
    action: input.action.trim(),
    tokenAddress: input.tokenAddress,
    chainId: String(input.chainId),
    agentWallet: input.agentWallet || ZERO_ADDRESS,
    executionHash,
    riskScore: input.riskScore,
    issuedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + PERMIT_TTL_MS).toISOString(),
    signerAddress: account.address,
    domain: createPermitDomain({
      chainId: REGISTRY_CHAIN_ID,
      verifyingContract: REGISTRY_ADDRESS,
    }),
  };
  if (input.amountUsd !== undefined) unsigned.amountUsd = String(input.amountUsd);
  if (input.recipient) unsigned.recipient = input.recipient;
  if (input.spender) unsigned.spender = input.spender;
  if (calldataHash) unsigned.calldataHash = calldataHash;

  return signExecutionAuthorization({ authorization: unsigned, privateKey });
}

export async function createPermitHash(authorization: ExecutionAuthorization): Promise<string> {
  return createPermitDigest(authorization);
}

export async function verifyExecutionAuthorization(
  authorization: ExecutionAuthorization,
): Promise<AuthorizationVerification> {
  const privateKey = process.env.PRIVATE_KEY;
  const expectedSignerAddress = privateKey
    ? (await import('viem/accounts')).privateKeyToAccount(
      privateKey.startsWith('0x') ? privateKey as `0x${string}` : `0x${privateKey}` as `0x${string}`,
    ).address
    : authorization.signerAddress;

  return verifyCanonicalExecutionAuthorization(authorization, {
    expectedSignerAddress,
    expectedDomain: createPermitDomain({
      chainId: REGISTRY_CHAIN_ID,
      verifyingContract: REGISTRY_ADDRESS,
    }),
  });
}
