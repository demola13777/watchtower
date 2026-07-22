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
export declare const ZERO_ADDRESS: "0x0000000000000000000000000000000000000000";
export declare const ZERO_BYTES32: Hex;
export declare const EXECUTION_AUTHORIZATION_TYPES: {
    readonly ExecutionAuthorization: readonly [{
        readonly name: "id";
        readonly type: "string";
    }, {
        readonly name: "action";
        readonly type: "string";
    }, {
        readonly name: "tokenAddress";
        readonly type: "address";
    }, {
        readonly name: "chainId";
        readonly type: "uint256";
    }, {
        readonly name: "agentWallet";
        readonly type: "address";
    }, {
        readonly name: "executionHash";
        readonly type: "bytes32";
    }, {
        readonly name: "amountUsd";
        readonly type: "string";
    }, {
        readonly name: "recipient";
        readonly type: "address";
    }, {
        readonly name: "spender";
        readonly type: "address";
    }, {
        readonly name: "calldataHash";
        readonly type: "bytes32";
    }, {
        readonly name: "riskScore";
        readonly type: "uint256";
    }, {
        readonly name: "issuedAt";
        readonly type: "uint256";
    }, {
        readonly name: "expiresAt";
        readonly type: "uint256";
    }];
};
export declare function hashCalldata(calldata?: string): Promise<Hex>;
export declare function createExecutionHash(input: ExecutionIntentInput): Promise<Hex>;
export declare function buildExecutionIntent(input: ExecutionIntentInput): Promise<{
    action: string;
    tokenAddress: `0x${string}`;
    chainId: string;
    agentWallet: `0x${string}`;
    executionHash: `0x${string}`;
    amountUsd: string;
    recipient: `0x${string}`;
    spender: `0x${string}`;
    calldataHash: `0x${string}`;
}>;
export declare function createPermitDomain(input: {
    chainId: string | number;
    verifyingContract: string;
}): ExecutionPermitDomain;
export declare const WatchTowerPolicy: {
    readonly Mainnet: {
        readonly signerAddress: "0xE4A3089Fc40C534DC4c628B7551e6f711fcCe1A1";
        readonly domain: ExecutionPermitDomain;
    };
};
export declare const DefaultAuthorizationPolicy: {
    readonly signerAddress: "0xE4A3089Fc40C534DC4c628B7551e6f711fcCe1A1";
    readonly domain: ExecutionPermitDomain;
};
export declare function verificationOptionsFromPolicy(policy?: WatchTowerAuthorizationPolicy): ExecutionAuthorizationVerificationOptions;
export declare function buildPermitMessage(authorization: ExecutionAuthorization): {
    id: string;
    action: string;
    tokenAddress: `0x${string}`;
    chainId: bigint;
    agentWallet: `0x${string}`;
    executionHash: `0x${string}`;
    amountUsd: string;
    recipient: `0x${string}`;
    spender: `0x${string}`;
    calldataHash: `0x${string}`;
    riskScore: bigint;
    issuedAt: bigint;
    expiresAt: bigint;
};
export declare function createPermitDigest(authorization: ExecutionAuthorization): Promise<Hex>;
export declare function signExecutionAuthorization(input: {
    authorization: Omit<ExecutionAuthorization, 'signature'>;
    privateKey: string;
}): Promise<ExecutionAuthorization>;
export declare function verifyExecutionAuthorization(authorization: ExecutionAuthorization, options?: ExecutionAuthorizationVerificationOptions): Promise<AuthorizationVerification>;
//# sourceMappingURL=permit.d.ts.map