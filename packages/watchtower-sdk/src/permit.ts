import type { Address, Hex } from 'viem';

export type AuthorizationDecision = 'AUTHORIZED' | 'REVIEW_REQUIRED' | 'DENIED';
export type AuthorizationVerdict = 'EXECUTE' | 'REVIEW' | 'ABORT';

export interface ExecutionPermitDomain {
  name: 'WatchTower';
  version: '1';
  chainId: number;
  verifyingContract: Address;
}

export interface ExecutionIntentInput {
  agentWallet: string;
  action: string;
  tokenAddress: string;
  chainId: string | number;
  amountUsd?: number | string;
  recipient?: string;
  spender?: string;
  calldata?: string;
  executionHash?: string;
}

export interface ExecutionAuthorization {
  id: string;
  action: string;
  tokenAddress: string;
  chainId: string;
  agentWallet: string;
  executionHash: Hex;
  amountUsd?: string;
  recipient?: string;
  spender?: string;
  calldataHash?: Hex;
  riskScore: number;
  issuedAt: string;
  expiresAt: string;
  signerAddress: string;
  domain: ExecutionPermitDomain;
  signature: string;
}

export interface AuthorizationVerification {
  signatureValid: boolean;
  expired: boolean;
  authorized: boolean;
  signerAddress: string | null;
  reason?: string;
}

export interface ExecutionAuthorizationVerificationOptions {
  expectedSignerAddress?: string;
  expectedDomain?: ExecutionPermitDomain;
}

export interface WatchTowerAuthorizationPolicy {
  signerAddress: string;
  domain: ExecutionPermitDomain;
}

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;
export const ZERO_BYTES32 = `0x${'0'.repeat(64)}` as Hex;

export const EXECUTION_AUTHORIZATION_TYPES = {
  ExecutionAuthorization: [
    { name: 'id', type: 'string' },
    { name: 'action', type: 'string' },
    { name: 'tokenAddress', type: 'address' },
    { name: 'chainId', type: 'uint256' },
    { name: 'agentWallet', type: 'address' },
    { name: 'executionHash', type: 'bytes32' },
    { name: 'amountUsd', type: 'string' },
    { name: 'recipient', type: 'address' },
    { name: 'spender', type: 'address' },
    { name: 'calldataHash', type: 'bytes32' },
    { name: 'riskScore', type: 'uint256' },
    { name: 'issuedAt', type: 'uint256' },
    { name: 'expiresAt', type: 'uint256' },
  ],
} as const;

function assertAddress(value: string, field: string): Address {
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error(`Invalid ${field}: expected 0x-prefixed EVM address.`);
  }
  return value.toLowerCase() as Address;
}

function assertHex(value: string, field: string): Hex {
  if (!/^0x[a-fA-F0-9]*$/.test(value)) {
    throw new Error(`Invalid ${field}: expected 0x-prefixed hex.`);
  }
  return value.toLowerCase() as Hex;
}

function assertBytes32(value: string, field: string): Hex {
  if (!/^0x[a-fA-F0-9]{64}$/.test(value)) {
    throw new Error(`Invalid ${field}: expected 32-byte 0x-prefixed hex.`);
  }
  return value.toLowerCase() as Hex;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export async function hashCalldata(calldata?: string): Promise<Hex> {
  if (!calldata) return ZERO_BYTES32;
  const { keccak256 } = await import('viem');
  return keccak256(assertHex(calldata, 'calldata'));
}

export async function createExecutionHash(input: ExecutionIntentInput): Promise<Hex> {
  if (input.executionHash) return assertBytes32(input.executionHash, 'executionHash');
  const { keccak256, toBytes } = await import('viem');
  const calldataHash = await hashCalldata(input.calldata);
  const canonical = stableStringify({
    action: input.action.trim(),
    agentWallet: assertAddress(input.agentWallet, 'agentWallet'),
    amountUsd: input.amountUsd === undefined ? '' : String(input.amountUsd),
    calldataHash,
    chainId: String(input.chainId),
    recipient: input.recipient ? assertAddress(input.recipient, 'recipient') : ZERO_ADDRESS,
    spender: input.spender ? assertAddress(input.spender, 'spender') : ZERO_ADDRESS,
    tokenAddress: assertAddress(input.tokenAddress, 'tokenAddress'),
  });
  return keccak256(toBytes(canonical));
}

export async function buildExecutionIntent(input: ExecutionIntentInput) {
  const calldataHash = await hashCalldata(input.calldata);
  return {
    action: input.action.trim(),
    tokenAddress: assertAddress(input.tokenAddress, 'tokenAddress'),
    chainId: String(input.chainId),
    agentWallet: assertAddress(input.agentWallet, 'agentWallet'),
    executionHash: await createExecutionHash(input),
    amountUsd: input.amountUsd === undefined ? '' : String(input.amountUsd),
    recipient: input.recipient ? assertAddress(input.recipient, 'recipient') : ZERO_ADDRESS,
    spender: input.spender ? assertAddress(input.spender, 'spender') : ZERO_ADDRESS,
    calldataHash,
  };
}

export function createPermitDomain(input: {
  chainId: string | number;
  verifyingContract: string;
}): ExecutionPermitDomain {
  return {
    name: 'WatchTower',
    version: '1',
    chainId: Number(input.chainId),
    verifyingContract: assertAddress(input.verifyingContract, 'verifyingContract'),
  };
}

export const WatchTowerPolicy = {
  Mainnet: {
    signerAddress: '0xE4A3089Fc40C534DC4c628B7551e6f711fcCe1A1',
    domain: createPermitDomain({
      chainId: 196,
      verifyingContract: '0x8B9d300f133E3bC754A88D00c1c46f8114019a2A',
    }),
  },
} as const satisfies Record<string, WatchTowerAuthorizationPolicy>;

export const DefaultAuthorizationPolicy = WatchTowerPolicy.Mainnet;

export function verificationOptionsFromPolicy(
  policy: WatchTowerAuthorizationPolicy = DefaultAuthorizationPolicy,
): ExecutionAuthorizationVerificationOptions {
  return {
    expectedSignerAddress: policy.signerAddress,
    expectedDomain: policy.domain,
  };
}

export function buildPermitMessage(authorization: ExecutionAuthorization) {
  return {
    id: authorization.id,
    action: authorization.action,
    tokenAddress: assertAddress(authorization.tokenAddress, 'tokenAddress'),
    chainId: BigInt(authorization.chainId),
    agentWallet: assertAddress(authorization.agentWallet, 'agentWallet'),
    executionHash: assertBytes32(authorization.executionHash, 'executionHash'),
    amountUsd: authorization.amountUsd ?? '',
    recipient: authorization.recipient ? assertAddress(authorization.recipient, 'recipient') : ZERO_ADDRESS,
    spender: authorization.spender ? assertAddress(authorization.spender, 'spender') : ZERO_ADDRESS,
    calldataHash: authorization.calldataHash ? assertBytes32(authorization.calldataHash, 'calldataHash') : ZERO_BYTES32,
    riskScore: BigInt(authorization.riskScore),
    issuedAt: BigInt(Math.floor(new Date(authorization.issuedAt).getTime() / 1000)),
    expiresAt: BigInt(Math.floor(new Date(authorization.expiresAt).getTime() / 1000)),
  };
}

export async function createPermitDigest(authorization: ExecutionAuthorization): Promise<Hex> {
  const { hashTypedData } = await import('viem');
  return hashTypedData({
    domain: authorization.domain,
    types: EXECUTION_AUTHORIZATION_TYPES,
    primaryType: 'ExecutionAuthorization',
    message: buildPermitMessage(authorization),
  });
}

export async function signExecutionAuthorization(input: {
  authorization: Omit<ExecutionAuthorization, 'signature'>;
  privateKey: string;
}): Promise<ExecutionAuthorization> {
  const { privateKeyToAccount } = await import('viem/accounts');
  const privateKey = input.privateKey.startsWith('0x') ? input.privateKey as Hex : `0x${input.privateKey}` as Hex;
  const account = privateKeyToAccount(privateKey);
  const unsigned = input.authorization;
  const signature = await account.signTypedData({
    domain: unsigned.domain,
    types: EXECUTION_AUTHORIZATION_TYPES,
    primaryType: 'ExecutionAuthorization',
    message: buildPermitMessage({ ...unsigned, signature: ZERO_BYTES32 }),
  });
  return { ...unsigned, signerAddress: account.address, signature };
}

export async function verifyExecutionAuthorization(
  authorization: ExecutionAuthorization,
  options: ExecutionAuthorizationVerificationOptions = {},
): Promise<AuthorizationVerification> {
  try {
    if (!authorization.signature) {
      return { signatureValid: false, expired: false, authorized: false, signerAddress: null, reason: 'missing_signature' };
    }
    if (!authorization.domain) {
      return { signatureValid: false, expired: false, authorized: false, signerAddress: null, reason: 'missing_domain' };
    }

    const signerAddress = assertAddress(authorization.signerAddress, 'signerAddress');
    if (options.expectedSignerAddress) {
      const expectedSignerAddress = assertAddress(options.expectedSignerAddress, 'expectedSignerAddress');
      if (signerAddress !== expectedSignerAddress) {
        return { signatureValid: false, expired: false, authorized: false, signerAddress: null, reason: 'unexpected_signer' };
      }
    }

    if (options.expectedDomain) {
      const expectedDomain = createPermitDomain(options.expectedDomain);
      const actualDomain = createPermitDomain(authorization.domain);
      const domainMatches = actualDomain.name === expectedDomain.name
        && actualDomain.version === expectedDomain.version
        && actualDomain.chainId === expectedDomain.chainId
        && actualDomain.verifyingContract === expectedDomain.verifyingContract;
      if (!domainMatches) {
        return { signatureValid: false, expired: false, authorized: false, signerAddress: null, reason: 'unexpected_domain' };
      }
    }

    const { verifyTypedData } = await import('viem');
    const expired = new Date(authorization.expiresAt).getTime() <= Date.now();
    const signatureValid = await verifyTypedData({
      address: signerAddress,
      domain: authorization.domain,
      types: EXECUTION_AUTHORIZATION_TYPES,
      primaryType: 'ExecutionAuthorization',
      message: buildPermitMessage(authorization),
      signature: authorization.signature as Hex,
    });
    const result: AuthorizationVerification = {
      signatureValid,
      expired,
      authorized: signatureValid && !expired,
      signerAddress: signatureValid ? signerAddress : null,
    };
    if (!signatureValid) result.reason = 'invalid_signature';
    if (signatureValid && expired) result.reason = 'expired';
    return result;
  } catch (error) {
    return {
      signatureValid: false,
      expired: false,
      authorized: false,
      signerAddress: null,
      reason: error instanceof Error ? error.message : 'verification_failed',
    };
  }
}
