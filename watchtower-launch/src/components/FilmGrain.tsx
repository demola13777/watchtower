import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';

export const FilmGrain: React.FC = () => {
  const frame = useCurrentFrame();

  // We generate a subtle SVG noise pattern that shifts each frame
  // Using CSS filter for grain effect
  return (
    <AbsoluteFill
      style={{
        pointerEvents: 'none',
        mixBlendMode: 'overlay',
        opacity: 0.06,
        background: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' seed='${frame % 60}' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundSize: '256px 256px',
      }}
    />
  );
};
