import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Img, staticFile } from 'remotion';
import { Particles } from '../components/Particles';
import { Subtitles } from '../components/Subtitles';
import { FilmGrain } from '../components/FilmGrain';
import { CrossFade } from '../components/CrossFade';

export const Scene3Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Radial glow expansion
  const glowSize = interpolate(frame, [30, 120], [0, 60], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Logo fade in
  const logoOpacity = interpolate(frame, [60, 90], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const logoScale = spring({ frame: frame - 60, fps, config: { damping: 18, mass: 1.2 } });

  // Pulsing glow on logo
  const glowPulse = 0.4 + Math.sin(frame * 0.05) * 0.2;

  // Title text: "WATCH TOWER"
  const titleY = spring({ frame: frame - 100, fps, config: { damping: 14 } });
  const titleOpacity = interpolate(frame, [100, 115], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Subtitle text: "The Security Oracle for AI"
  const subY = spring({ frame: frame - 130, fps, config: { damping: 14 } });
  const subOpacity = interpolate(frame, [130, 145], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <CrossFade durationInFrames={315} fadeIn={0}>
      <AbsoluteFill
        style={{
          backgroundColor: '#000000',
          background: `radial-gradient(circle at 50% 45%, rgba(10, 25, 47, ${interpolate(frame, [30, 120], [0, 0.8], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}) 0%, #000000 ${glowSize}%)`,
        }}
      >
        {/* Center content */}
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* Logo */}
            <Img
              src={staticFile('watchtower_logo.png')}
              style={{
                width: 250,
                height: 250,
                opacity: logoOpacity,
                transform: `scale(${Math.min(logoScale, 1)})`,
                clipPath: 'inset(12% 12% 12% 12% round 18%)',
                filter: `drop-shadow(0 0 60px rgba(0, 240, 255, ${glowPulse}))`,
              }}
            />

            {/* Title */}
            <h1
              style={{
                fontFamily: 'Inter, system-ui, sans-serif',
                fontSize: 72,
                fontWeight: 900,
                color: '#ffffff',
                letterSpacing: 8,
                margin: '40px 0 0 0',
                opacity: titleOpacity,
                transform: `translateY(${interpolate(titleY, [0, 1], [30, 0])}px)`,
              }}
            >
              WATCH TOWER
            </h1>

            {/* Tagline */}
            <p
              style={{
                fontFamily: 'Inter, system-ui, sans-serif',
                fontSize: 32,
                fontWeight: 400,
                color: '#00f0ff',
                margin: '16px 0 0 0',
                opacity: subOpacity,
                transform: `translateY(${interpolate(subY, [0, 1], [30, 0])}px)`,
                textShadow: '0 0 20px rgba(0, 240, 255, 0.3)',
              }}
            >
              The Security Oracle for AI
            </p>
          </div>
        </AbsoluteFill>

        <Particles count={25} color="#00f0ff" speed={0.2} />
        <FilmGrain />
        <Subtitles
          cues={[
            { text: 'Enter Watch Tower.', startFrame: 18, endFrame: 84 },
            { text: 'The AI-native security oracle and onchain attestation protocol.', startFrame: 92, endFrame: 190 },
            { text: 'Security context before capital is put at risk.', startFrame: 198, endFrame: 300 },
          ]}
        />
      </AbsoluteFill>
    </CrossFade>
  );
};
