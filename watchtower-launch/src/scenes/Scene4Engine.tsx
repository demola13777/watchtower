import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { Particles } from '../components/Particles';
import { Subtitles } from '../components/Subtitles';
import { FilmGrain } from '../components/FilmGrain';
import { CrossFade } from '../components/CrossFade';

interface NodeProps {
  label: string;
  detail?: string;
  x: number;
  y: number;
  delay: number;
  size?: number;
  borderColor?: string;
  isHex?: boolean;
}

const GlassNode: React.FC<NodeProps> = ({ label, detail, x, y, delay, size = 120, borderColor = '#00f0ff', isHex = true }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({ frame: frame - delay, fps, config: { damping: 12 } });
  const glow = 0.3 + Math.sin((frame - delay) * 0.04) * 0.15;

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `translate(-50%, -50%) scale(${Math.min(scale, 1)})`,
        width: size,
        height: size,
        background: 'rgba(255, 255, 255, 0.04)',
        backdropFilter: 'blur(20px)',
        border: `1px solid ${borderColor}`,
        borderRadius: isHex ? 0 : '50%',
        clipPath: isHex
          ? 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'
          : undefined,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        boxShadow: `0 0 30px rgba(0, 240, 255, ${glow})`,
      }}
    >
      <div style={{ textAlign: 'center', padding: 14 }}>
        <div
          style={{
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: size > 140 ? 20 : 15,
            fontWeight: 750,
            color: '#ffffff',
            lineHeight: 1.15,
            textShadow: '0 0 10px rgba(0,240,255,0.3)',
          }}
        >
          {label}
        </div>
        {detail ? (
          <div
            style={{
              color: 'rgba(103, 232, 249, 0.72)',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 1.1,
              marginTop: 8,
            }}
          >
            {detail}
          </div>
        ) : null}
      </div>
    </div>
  );
};

const ConnectionLine: React.FC<{ x1: number; y1: number; x2: number; y2: number; delay: number }> = ({
  x1, y1, x2, y2, delay,
}) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [delay, delay + 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  return (
    <div
      style={{
        position: 'absolute',
        left: x1,
        top: y1,
        width: length * progress,
        height: 2,
        background: 'linear-gradient(90deg, rgba(0,240,255,0.4), rgba(0,240,255,0.1))',
        transform: `rotate(${angle}deg)`,
        transformOrigin: '0 0',
        boxShadow: '0 0 8px rgba(0,240,255,0.2)',
      }}
    />
  );
};

const DataDot: React.FC<{ x1: number; y1: number; x2: number; y2: number; speed: number; offset: number }> = ({
  x1, y1, x2, y2, speed, offset,
}) => {
  const frame = useCurrentFrame();
  const t = ((frame * speed + offset) % 100) / 100;

  return (
    <div
      style={{
        position: 'absolute',
        left: x1 + (x2 - x1) * t,
        top: y1 + (y2 - y1) * t,
        width: 6,
        height: 6,
        borderRadius: '50%',
        backgroundColor: '#00f0ff',
        boxShadow: '0 0 12px #00f0ff',
        transform: 'translate(-50%, -50%)',
        opacity: 0.8,
      }}
    />
  );
};

export const Scene4Engine: React.FC = () => {
  const frame = useCurrentFrame();
  // Layout positions (centered around 960, 540)
  const cx = 960;
  const cy = 540;
  const agentX = cx - 320;
  const wtX = cx;
  const wtY = cy;

  const nodes = [
    { label: 'Liquidity', detail: 'DEXSCREENER', x: cx + 280, y: cy - 180 },
    { label: 'Contract DNA', detail: 'GOPLUS', x: cx + 280, y: cy + 180 },
    { label: 'Whale Intel', detail: 'ETHPLORER', x: cx - 280, y: cy - 180 },
    { label: 'Social Radar', detail: 'MARKET SIGNALS', x: cx - 280, y: cy + 180 },
  ];

  // Title
  const titleOpacity = interpolate(frame, [125, 150], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const titleY = interpolate(frame, [125, 150], [20, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <CrossFade durationInFrames={300}>
      <AbsoluteFill
        style={{
          background: 'radial-gradient(circle at 50% 50%, #0a1628 0%, #050510 70%)',
        }}
      >
        {/* Title */}
        <div
          style={{
            position: 'absolute',
            top: 70,
            width: '100%',
            textAlign: 'center',
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
          }}
        >
          <h2
            style={{
              fontFamily: 'Inter, system-ui, sans-serif',
              fontSize: 48,
              fontWeight: 700,
              color: '#ffffff',
              textShadow: '0 0 20px rgba(0,240,255,0.2)',
            }}
          >
            Real-time Cognitive Context
          </h2>
        </div>

        {/* Connection lines */}
        <ConnectionLine x1={agentX} y1={cy} x2={wtX} y2={wtY} delay={30} />
        {nodes.map((n, i) => (
          <ConnectionLine key={i} x1={wtX} y1={wtY} x2={n.x} y2={n.y} delay={60 + i * 15} />
        ))}

        {/* Data dots flowing along connections (only after frame 150) */}
        {frame > 150 && (
          <>
            <DataDot x1={agentX} y1={cy} x2={wtX} y2={wtY} speed={1.5} offset={0} />
            {nodes.map((n, i) => (
              <DataDot key={i} x1={wtX} y1={wtY} x2={n.x} y2={n.y} speed={1.2} offset={i * 25} />
            ))}
          </>
        )}

        {/* Nodes */}
        <GlassNode label="AI Agent" detail="EXECUTION" x={agentX} y={cy} delay={10} size={118} borderColor="rgba(255,255,255,0.3)" isHex={false} />
        <GlassNode label="Watch Tower" detail="THREAT ENGINE" x={wtX} y={wtY} delay={60} size={170} borderColor="#00f0ff" />
        {nodes.map((n, i) => (
          <GlassNode key={i} label={n.label} detail={n.detail} x={n.x} y={n.y} delay={90 + i * 15} size={138} />
        ))}

        <Particles count={35} color="#00f0ff" speed={0.3} />
        <FilmGrain />
        <Subtitles
          cues={[
            { text: 'Before an agent acts, Watch Tower intercepts.', startFrame: 10, endFrame: 80 },
            { text: 'Live signals: liquidity, contract behavior, whale concentration, and market activity.', startFrame: 88, endFrame: 190 },
            { text: 'One policy-ready verdict, returned in real time.', startFrame: 198, endFrame: 285 },
          ]}
        />
      </AbsoluteFill>
    </CrossFade>
  );
};
