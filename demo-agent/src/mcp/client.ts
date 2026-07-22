// ───────────────────────────────────────────────────────────────
// Watch Tower MCP Client
//
// Communicates with the Watch Tower MCP server via stateless
// JSON-RPC over HTTP. Watch Tower is the authoritative security
// middleware — the agent CANNOT trade without consulting it.
// ───────────────────────────────────────────────────────────────

export type ScanMode = 'firewall' | 'deep';
export type AgentMode = ScanMode | 'authorize';

export interface WatchTowerScanResult {
  reportType: string;
  tier: string;
  generatedAt: string;
  target: {
    tokenAddress: string;
    chainId: string;
    chainResolution: {
      chainId: string;
      chainName: string;
      source: string;
      confidence: string;
    };
  };
  verdict: {
    threatScore: number;
    confidence: number;
    recommendation: 'TRADE' | 'CAUTION' | 'ABORT';
    summary?: string;
  };
  intelligenceModules: Array<{
    name: string;
    score: number;
    weight: number;
    status: string;
    signals: string[];
  }>;
  reasoning: string[];
  verification: {
    scanHash: string;
    txHash?: string;
  };
  recommendations?: string[];
  meta: {
    engine: string;
    network: string;
    reportUrl: string;
  };
}

export interface WatchTowerAuthorizationResult {
  decision: 'AUTHORIZED' | 'REVIEW_REQUIRED' | 'DENIED';
  verdict: 'EXECUTE' | 'REVIEW' | 'ABORT';
  riskScore: number;
  confidence: number;
  reasoning: string[];
  authorization: {
    id: string;
    action: string;
    tokenAddress: string;
    chainId: string;
    agentWallet: string;
    executionHash: `0x${string}`;
    amountUsd?: string;
    recipient?: string;
    spender?: string;
    calldataHash?: `0x${string}`;
    riskScore: number;
    issuedAt: string;
    expiresAt: string;
    signerAddress: string;
    domain: {
      name: 'WatchTower';
      version: '1';
      chainId: number;
      verifyingContract: `0x${string}`;
    };
    signature: `0x${string}`;
  } | null;
  verification?: {
    signatureValid: boolean;
    expired: boolean;
    authorized: boolean;
    signerAddress: string | null;
    reason?: string;
  } | null;
  executable?: boolean;
  scan?: {
    analysisHash?: string;
    scanHash: string;
    reportHash?: string;
    permitHash?: string | null;
    reportUrl: string;
  };
  attestation: {
    status?: 'pending' | 'confirmed' | 'failed';
    permitHash: string;
    txHash?: string | null;
    chain?: string;
    reason?: string;
  } | null;
}

export class WatchTowerMCPClient {
  private endpoint: string;
  private requestId = 0;

  constructor(endpoint: string) {
    this.endpoint = endpoint;
  }

  /**
   * Verify connectivity by listing available MCP tools.
   * Returns the list of tool names.
   */
  async verifyConnection(): Promise<string[]> {
    const response = await this.rpc('tools/list', {});
    const tools = response?.tools ?? [];
    return tools.map((t: { name: string }) => t.name);
  }

  /**
   * Execute a scan_token call through the MCP interface.
   * Quick firewall-level threat scan.
   */
  async scanToken(tokenAddress: string, chainId?: string): Promise<WatchTowerScanResult> {
    return this.callTool('scan_token', tokenAddress, chainId);
  }

  /**
   * Execute the legacy deep_scan_token MCP tool.
   * Compatibility alias for Execution Authorization / Permission to Execute.
   */
  async deepScanToken(tokenAddress: string, chainId?: string): Promise<WatchTowerScanResult> {
    return this.callTool('deep_scan_token', tokenAddress, chainId);
  }

  /**
   * Convenience method — picks the right tool based on scan mode.
   */
  async scan(mode: ScanMode, tokenAddress: string, chainId?: string): Promise<WatchTowerScanResult> {
    return mode === 'deep'
      ? this.deepScanToken(tokenAddress, chainId)
      : this.scanToken(tokenAddress, chainId);
  }

  /**
   * Request Execution Authorization through the MCP interface.
   * Returns a cryptographically signed authorization when the action is deemed safe.
   */
  async authorizeTransaction(tokenAddress: string, chainId?: string, action?: string): Promise<WatchTowerAuthorizationResult> {
    const args: Record<string, string> = { tokenAddress };
    if (chainId) args.chainId = chainId;
    if (action) args.action = action;

    const response = await this.rpc('tools/call', {
      name: 'authorize_transaction',
      arguments: args,
    });

    const content = response?.content;
    if (!content || !Array.isArray(content) || content.length === 0) {
      throw new Error('Watch Tower returned an empty response. Authorization failed.');
    }

    const textBlock = content.find((c: { type: string }) => c.type === 'text');
    if (!textBlock?.text) {
      throw new Error('Watch Tower response missing text content. Authorization failed.');
    }

    if (response.isError) {
      let errorMessage = textBlock.text;
      try {
        const parsed = JSON.parse(textBlock.text);
        if (parsed.error) errorMessage = parsed.error;
      } catch { /* not JSON */ }
      throw new Error(errorMessage);
    }

    try {
      const parsed = JSON.parse(textBlock.text) as WatchTowerAuthorizationResult | { error: string };
      if ('error' in parsed && parsed.error) {
        throw new Error(parsed.error);
      }
      return parsed as WatchTowerAuthorizationResult;
    } catch (err: unknown) {
      if (err instanceof Error && err.message !== 'Unexpected token') {
        throw err;
      }
      throw new Error(`Watch Tower returned unparseable response: ${textBlock.text}`);
    }
  }

  /**
   * Internal helper — calls any scan tool by name and parses the response.
   */
  private async callTool(toolName: string, tokenAddress: string, chainId?: string): Promise<WatchTowerScanResult> {
    const args: Record<string, string> = { tokenAddress };
    if (chainId) args.chainId = chainId;

    const response = await this.rpc('tools/call', {
      name: toolName,
      arguments: args,
    });

    // MCP tool responses wrap content in an array of { type, text } objects
    const content = response?.content;
    if (!content || !Array.isArray(content) || content.length === 0) {
      throw new Error('Watch Tower returned an empty response. Security verification failed.');
    }

    const textBlock = content.find((c: { type: string }) => c.type === 'text');
    if (!textBlock?.text) {
      throw new Error('Watch Tower response missing text content. Security verification failed.');
    }

    if (response.isError) {
      let errorMessage = textBlock.text;
      try {
        const parsed = JSON.parse(textBlock.text);
        if (parsed.error) errorMessage = parsed.error;
      } catch { /* not JSON — use raw text */ }
      throw new Error(errorMessage);
    }

    try {
      const parsed = JSON.parse(textBlock.text) as WatchTowerScanResult | { error: string };
      if ('error' in parsed && parsed.error) {
        throw new Error(parsed.error);
      }
      return parsed as WatchTowerScanResult;
    } catch (err: unknown) {
      if (err instanceof Error && err.message !== 'Unexpected token') {
        throw err;
      }
      throw new Error(`Watch Tower returned unparseable response: ${textBlock.text}`);
    }
  }

  /**
   * Send a JSON-RPC request to the Watch Tower MCP endpoint.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async rpc(method: string, params: Record<string, unknown>): Promise<any> {
    const body = {
      jsonrpc: '2.0',
      id: ++this.requestId,
      method,
      params,
    };

    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify(body),
        // Keep a generous client timeout for paid request recovery and cold starts.
        signal: AbortSignal.timeout(90_000),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => 'unknown error');
        throw new Error(`Watch Tower MCP error (${res.status}): ${text}`);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json = (await res.json()) as any;

      if (json.error) {
        throw new Error(`Watch Tower MCP RPC error: ${JSON.stringify(json.error)}`);
      }

      return json.result;
    } catch (error) {
      throw error;
    }
  }
}
