import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import { Particles } from '../components/Particles';
import { Subtitles } from '../components/Subtitles';
import { FilmGrain } from '../components/FilmGrain';
import { CrossFade } from '../components/CrossFade';

const CODE_LINES = [
  { text: "import", type: "keyword" },
  { text: " { WatchTowerClient } ", type: "default" },
  { text: "from", type: "keyword" },
  { text: " 'okx-watchtower-middleware'", type: "string" },
  { text: ";", type: "default" },
  { text: "\n\n", type: "default" },
  { text: "const", type: "keyword" },
  { text: " tower = ", type: "default" },
  { text: "new", type: "keyword" },
  { text: " WatchTowerClient", type: "type" },
  { text: "({ apiUrl, agentWallet });", type: "default" },
  { text: "\n", type: "default" },
  { text: "const", type: "keyword" },
  { text: " intel = ", type: "default" },
  { text: "await", type: "keyword" },
  { text: " tower.", type: "default" },
  { text: "guardTransaction", type: "function" },
  { text: "(tokenAddress);", type: "default" },
  { text: "\n", type: "default" },
  { text: "submitTrade", type: "function" },
  { text: "(intel);", type: "default" },
];

const TYPE_COLORS: Record<string, string> = {
  keyword: '#c586c0',
  string: '#ce9178',
  function: '#dcdcaa',
  type: '#4ec9b0',
  comment: '#6a9955',
  default: '#d4d4d4',
};

export const Scene8DevExp: React.FC = () => {
  const frame = useCurrentFrame();

  // Build the full string for typewriter calculation
  const fullText = CODE_LINES.map((t) => t.text).join('');
  const charsToShow = Math.floor(
    interpolate(frame, [18, 165], [0, fullText.length], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
  );

  // Build visible tokens
  let charsConsumed = 0;
  const visibleTokens: Array<{ text: string; color: string }> = [];
  for (const token of CODE_LINES) {
    if (charsConsumed >= charsToShow) break;
    const remaining = charsToShow - charsConsumed;
    const visiblePart = token.text.slice(0, remaining);
    visibleTokens.push({ text: visiblePart, color: TYPE_COLORS[token.type] || TYPE_COLORS.default });
    charsConsumed += token.text.length;
  }

  // Blinking cursor
  const cursorOpacity = Math.round(Math.sin(frame * 0.15) * 0.5 + 0.5);

  // "3 Lines of Code" tagline
  const taglineOpacity = interpolate(frame, [175, 205], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const taglineY = interpolate(frame, [175, 205], [30, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // X Layer orb float
  const orbFloat = Math.sin(frame / 15) * 20;

  // Line numbers
  const codeStr = visibleTokens.map((t) => t.text).join('');
  const lineCount = (codeStr.match(/\n/g) || []).length + 1;

  return (
    <CrossFade durationInFrames={300}>
      <AbsoluteFill style={{ backgroundColor: '#050510', display: 'flex', flexDirection: 'row' }}>
        {/* Left: Code Editor (60%) */}
        <div style={{ width: '60%', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 60 }}>
          <div
            style={{
              width: '100%',
              maxWidth: 750,
              backgroundColor: '#1e1e1e',
              borderRadius: 16,
              overflow: 'hidden',
              boxShadow: '0 20px 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.08)',
            }}
          >
            {/* Editor title bar */}
            <div
              style={{
                height: 36,
                backgroundColor: '#252526',
                display: 'flex',
                alignItems: 'center',
                padding: '0 16px',
                gap: 8,
              }}
            >
              <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#ff5f56' }} />
              <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#ffbd2e' }} />
              <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#27c93f' }} />
              <span
                style={{
                  marginLeft: 12,
                  color: '#999',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  fontSize: 13,
                }}
              >
                watchtower-agent.ts
              </span>
            </div>

            {/* Code area */}
            <div style={{ display: 'flex', padding: '24px 0' }}>
              {/* Line numbers */}
              <div style={{ padding: '0 16px', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
                {Array.from({ length: Math.max(lineCount, 8) }, (_, i) => (
                  <div
                    key={i}
                    style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 16,
                      lineHeight: '26px',
                      color: '#555',
                      textAlign: 'right',
                      minWidth: 24,
                    }}
                  >
                    {i + 1}
                  </div>
                ))}
              </div>

              {/* Code content */}
              <div style={{ padding: '0 20px', flex: 1 }}>
                <pre
                  style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 16,
                    lineHeight: '26px',
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {visibleTokens.map((t, i) => (
                    <span key={i} style={{ color: t.color }}>
                      {t.text}
                    </span>
                  ))}
                  <span style={{ color: '#00f0ff', opacity: cursorOpacity }}>▌</span>
                </pre>
              </div>
            </div>
          </div>
        </div>

        {/* Right: X Layer branding (40%) */}
        <div
          style={{
            width: '40%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              width: 210,
              height: 1,
              background: 'linear-gradient(90deg, transparent, rgba(0, 240, 255, 0.8), transparent)',
              boxShadow: '0 0 18px rgba(0, 240, 255, 0.55)',
              marginBottom: 32,
              opacity: interpolate(frame, [180, 220], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
            }}
          />
          <div
            style={{
              width: 160,
              height: 160,
              borderRadius: '50%',
              border: '2px solid #00f0ff',
              backgroundColor: 'rgba(0, 240, 255, 0.04)',
              boxShadow: '0 0 50px rgba(0, 240, 255, 0.3), inset 0 0 30px rgba(0, 240, 255, 0.05)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              transform: `translateY(${orbFloat}px)`,
            }}
          >
            <span
              style={{
                fontFamily: 'Inter, system-ui, sans-serif',
                fontSize: 28,
                fontWeight: 700,
                color: '#ffffff',
              }}
            >
              X Layer
            </span>
          </div>
          <p
            style={{
              fontFamily: 'Inter, system-ui, sans-serif',
              fontSize: 16,
              color: '#888',
              textAlign: 'center',
              marginTop: 24,
              maxWidth: 250,
              lineHeight: 1.5,
            }}
          >
            Security receipts that stay economically viable
          </p>
        </div>

        {/* Tagline across bottom */}
        <div
          style={{
            position: 'absolute',
            bottom: 120,
            width: '100%',
            textAlign: 'center',
            opacity: taglineOpacity,
            transform: `translateY(${taglineY}px)`,
          }}
        >
          <h2
            style={{
              fontFamily: 'Inter, system-ui, sans-serif',
              fontSize: 56,
              fontWeight: 800,
              color: '#ffffff',
              textShadow: '0 0 30px rgba(0, 240, 255, 0.3)',
            }}
          >
            One security gate. Every trade.
          </h2>
        </div>

        <Particles count={20} color="#00f0ff" speed={0.2} />
        <FilmGrain />
        <Subtitles
          cues={[
            { text: 'A single SDK guard turns intelligence into agent policy.', startFrame: 12, endFrame: 140 },
            { text: 'X Layer makes high-frequency security receipts economically viable.', startFrame: 155, endFrame: 285 },
          ]}
        />
      </AbsoluteFill>
    </CrossFade>
  );
};
