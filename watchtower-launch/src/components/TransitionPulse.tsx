import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';

const TRANSITIONS = [
  { frame: 210, color: '#ff3355' },
  { frame: 525, color: '#00f0ff' },
  { frame: 840, color: '#00f0ff' },
  { frame: 1140, color: '#00f0ff' },
  { frame: 1635, color: '#20f58b' },
  { frame: 2070, color: '#00f0ff' },
  { frame: 2475, color: '#a855f7' },
  { frame: 2775, color: '#00f0ff' },
];

export const TransitionPulse: React.FC = () => {
  const frame = useCurrentFrame();
  const transition = TRANSITIONS.find((item) => frame >= item.frame && frame < item.frame + 16);

  if (!transition) return null;

  const localFrame = frame - transition.frame;
  const pulseOpacity = interpolate(localFrame, [0, 3, 16], [0, 0.38, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const lineOpacity = interpolate(localFrame, [0, 2, 11, 16], [0, 0.9, 0.35, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const lineX = interpolate(localFrame, [0, 16], [-55, 155], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', overflow: 'hidden' }}>
      <AbsoluteFill
        style={{
          opacity: pulseOpacity,
          background: `radial-gradient(ellipse at 50% 50%, ${transition.color}40 0%, transparent 52%)`,
          mixBlendMode: 'screen',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: `${lineX}%`,
          width: '52%',
          height: 2,
          opacity: lineOpacity,
          background: `linear-gradient(90deg, transparent, ${transition.color}, transparent)`,
          boxShadow: `0 0 24px ${transition.color}`,
          transform: 'translateY(-50%) skewX(-28deg)',
        }}
      />
    </AbsoluteFill>
  );
};
