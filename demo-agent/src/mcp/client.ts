// ───────────────────────────────────────────────────────────────
// Watch Tower MCP Client
//
// Communicates with the Watch Tower MCP server via stateless
// JSON-RPC over HTTP. Watch Tower is the authoritative security
// middleware — the agent CANNOT trade without consulting it.
// ───────────────────────────────────────────────────────────────

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
  meta: {
    engine: string;
    network: string;
    reportUrl: string;
  };
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
   * This is the mandatory security gate — no trade executes without this.
   */
  async scanToken(tokenAddress: string, chainId?: string): Promise<WatchTowerScanResult> {
    const args: Record<string, string> = { tokenAddress };
    if (chainId) args.chainId = chainId;

    const response = await this.rpc('tools/call', {
      name: 'scan_token',
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

    try {
      return JSON.parse(textBlock.text) as WatchTowerScanResult;
    } catch {
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

    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify(body),
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
  }
}
