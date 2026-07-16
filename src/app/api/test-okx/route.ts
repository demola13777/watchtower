import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET() {
  try {
    const apiKey = process.env.OKX_API_KEY || '';
    const secretKey = process.env.OKX_SECRET_KEY || '';
    const passphrase = process.env.OKX_PASSPHRASE || '';

    const timestamp = new Date().toISOString();
    const method = 'GET';
    const requestPath = '/api/v6/pay/x402/supported';
    const prehash = timestamp + method + requestPath;
    const sign = crypto.createHmac('sha256', secretKey).update(prehash).digest('base64');

    const res = await fetch('https://web3.okx.com' + requestPath, {
      method,
      headers: {
        'OK-ACCESS-KEY': apiKey,
        'OK-ACCESS-SIGN': sign,
        'OK-ACCESS-TIMESTAMP': timestamp,
        'OK-ACCESS-PASSPHRASE': passphrase,
        'Content-Type': 'application/json'
      }
    });

    const text = await res.text();
    return NextResponse.json({
      status: res.status,
      body: text,
      keys_present: {
        key_len: apiKey.length,
        secret_len: secretKey.length,
        pass_len: passphrase.length,
        pass_last_char: passphrase.slice(-1)
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
