import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';

interface CrossFadeProps {
  children: React.ReactNode;
  durationInFrames: number;
  fadeIn?: number;
  fadeOut?: number;
}

export const CrossFade: React.FC<CrossFadeProps> = ({ children, durationInFrames, fadeIn = 0, fadeOut = 0 }) => {
  const frame = useCurrentFrame();

  const fadeInOpacity = fadeIn
    ? interpolate(frame, [0, fadeIn], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : 1;
  const fadeOutOpacity = fadeOut
    ? interpolate(
      frame,
      [durationInFrames - fadeOut, durationInFrames],
      [1, 0],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    )
    : 1;
  const opacity = fadeInOpacity * fadeOutOpacity;

  return (
    <AbsoluteFill style={{ opacity }}>
      {children}
    </AbsoluteFill>
  );
};
