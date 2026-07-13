import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import { Particles } from '../components/Particles';
import { Subtitles } from '../components/Subtitles';
import { FilmGrain } from '../components/FilmGrain';
import { CrossFade } from '../components/CrossFade';

const seeded = (s: number) => {
  const x = Math.sin(s * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const DataStream: React.FC<{ index: number }> = ({ index }) => {
  const frame = useCurrentFrame();
  const x = seeded(index) * 100;
  const speed = 2 + seeded(index + 50) * 6;
  const width = 1 + seeded(index + 100) * 3;
  const opacity = 0.08 + seeded(index + 150) * 0.15;
  const hue = seeded(index + 200) > 0.5 ? '#00f0ff' : '#ff00f0';
  const height = 100 + seeded(index + 300) * 400;
  const yOffset = ((frame * speed) % (1080 + height)) - height;

  return (
    <div
      style={{
        position: 'absolute',
        left: `${x}%`,
        top: yOffset,
        width,
        height,
        background: `linear-gradient(to bottom, transparent, ${hue}, transparent)`,
        opacity,
        filter: `blur(${width > 2 ? 1 : 0}px)`,
      }}
    />
  );
};

export const Scene1Problem: React.FC = () => {
  const frame = useCurrentFrame();

  // Line 1: "The next era of DeFi isn't human."
  const line1Opacity = interpolate(frame, [30, 55], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const line1Y = interpolate(frame, [30, 55], [30, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Line 2: "It's autonomous."
  const line2Opacity = interpolate(frame, [70, 95], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const line2Y = interpolate(frame, [70, 95], [30, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Slow scale of entire text block
  const textScale = interpolate(frame, [30, 210], [1, 1.06], { extrapolateRight: 'clamp' });

  return (
    <CrossFade durationInFrames={210}>
      <AbsoluteFill
        style={{
          background: 'linear-gradient(180deg, #050510 0%, #0a0f2e 100%)',
        }}
      >
        {/* Data Streams */}
        <AbsoluteFill style={{ overflow: 'hidden' }}>
          {Array.from({ length: 25 }, (_, i) => (
            <DataStream key={i} index={i} />
          ))}
        </AbsoluteFill>

        {/* Horizontal scan line */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: (frame * 2) % 1080,
            height: 1,
            background: 'linear-gradient(90deg, transparent, rgba(0,240,255,0.15), transparent)',
          }}
        />

        {/* Central Text */}
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ transform: `scale(${textScale})`, textAlign: 'center' }}>
            <h1
              style={{
                fontFamily: 'Inter, system-ui, sans-serif',
                fontSize: 72,
                fontWeight: 700,
                color: '#ffffff',
                textShadow: '0 0 30px rgba(0,240,255,0.3)',
                opacity: line1Opacity,
                transform: `translateY(${line1Y}px)`,
                margin: 0,
                lineHeight: 1.2,
              }}
            >
              The next era of DeFi isn't human.
            </h1>
            <h1
              style={{
                fontFamily: 'Inter, system-ui, sans-serif',
                fontSize: 72,
                fontWeight: 700,
                color: '#00f0ff',
                textShadow: '0 0 40px rgba(0,240,255,0.4)',
                opacity: line2Opacity,
                transform: `translateY(${line2Y}px)`,
                margin: '20px 0 0 0',
                lineHeight: 1.2,
              }}
            >
              It's autonomous.
            </h1>
          </div>
        </AbsoluteFill>

        <Particles count={50} color="#00f0ff" speed={0.3} />
        <FilmGrain />
        <Subtitles
          cues={[
            { text: "The next era of DeFi isn't human.", startFrame: 8, endFrame: 58 },
            { text: "It's autonomous.", startFrame: 66, endFrame: 120 },
            { text: 'AI agents discover liquidity, size positions, and execute at machine speed.', startFrame: 128, endFrame: 203 },
          ]}
        />
      </AbsoluteFill>
    </CrossFade>
  );
};
