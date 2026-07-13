import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';

interface ParticlesProps {
  count?: number;
  color?: string;
  speed?: number;
}

// Deterministic pseudo-random based on index (no Math.random in Remotion)
const seededRandom = (seed: number) => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export const Particles: React.FC<ParticlesProps> = ({ count = 40, color = '#00f0ff', speed = 0.5 }) => {
  const frame = useCurrentFrame();

  const particles = React.useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      x: seededRandom(i) * 100,
      y: seededRandom(i + 100) * 100,
      size: seededRandom(i + 200) * 3 + 1,
      opacity: seededRandom(i + 300) * 0.3 + 0.05,
      drift: seededRandom(i + 400) * 2 - 1,
      phaseOffset: seededRandom(i + 500) * Math.PI * 2,
    }));
  }, [count]);

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', overflow: 'hidden' }}>
      {particles.map((p, i) => {
        const yPos = (p.y + frame * speed * 0.15 + p.drift * frame * 0.02) % 120 - 10;
        const xPos = p.x + Math.sin(frame * 0.02 + p.phaseOffset) * 3;
        const flickerOpacity = p.opacity * (0.7 + 0.3 * Math.sin(frame * 0.05 + p.phaseOffset));

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${xPos}%`,
              top: `${yPos}%`,
              width: p.size,
              height: p.size,
              borderRadius: '50%',
              backgroundColor: color,
              opacity: flickerOpacity,
              boxShadow: `0 0 ${p.size * 4}px ${color}`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};
