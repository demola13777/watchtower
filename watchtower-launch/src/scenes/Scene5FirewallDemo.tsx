import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Video, staticFile } from 'remotion';
import { Particles } from '../components/Particles';
import { Subtitles } from '../components/Subtitles';
import { FilmGrain } from '../components/FilmGrain';
import { CrossFade } from '../components/CrossFade';

export const Scene5FirewallDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Scene label (DEMO 1) appears first, fades out as window comes in
  const labelOpacity = interpolate(frame, [0, 10, 25, 45], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const labelScale = interpolate(frame, [0, 15], [0.9, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Browser window slides up
  const windowY = spring({ frame: frame - 20, fps, config: { damping: 15, mass: 1.1 } });
  const windowTranslateY = interpolate(windowY, [0, 1], [1080, 0]);

  return (
    <CrossFade durationInFrames={495}>
      <AbsoluteFill
        style={{
          background: 'radial-gradient(ellipse at 50% 30%, #0a1628 0%, #050510 70%)',
        }}
      >
        {/* Scene Label */}
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', opacity: labelOpacity }}>
          <div style={{ textAlign: 'center', transform: `scale(${labelScale})` }}>
            <h1
              style={{
                fontFamily: 'Inter, system-ui, sans-serif',
                fontSize: 80,
                fontWeight: 900,
                color: '#00f0ff',
                margin: 0,
                textShadow: '0 0 40px rgba(0, 240, 255, 0.5)',
              }}
            >
              DEMO 1
            </h1>
            <p
              style={{
                fontFamily: 'Inter, system-ui, sans-serif',
                fontSize: 28,
                fontWeight: 400,
                color: 'rgba(255, 255, 255, 0.7)',
                marginTop: 12,
              }}
            >
              BitConnect — CAUTION / REVIEW
            </p>
          </div>
        </AbsoluteFill>

        {/* Browser Window */}
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
          <div
            style={{
              transform: `translateY(${windowTranslateY}px)`,
              width: 1440,
              height: 820,
              borderRadius: 20,
              overflow: 'hidden',
              boxShadow: '0 30px 80px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.05)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Title Bar */}
            <div
              style={{
                height: 44,
                backgroundColor: '#1c1c1c',
                display: 'flex',
                alignItems: 'center',
                padding: '0 20px',
                gap: 8,
                flexShrink: 0,
              }}
            >
              <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#ff5f56' }} />
              <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#ffbd2e' }} />
              <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#27c93f' }} />
              <div
                style={{
                  flex: 1,
                  textAlign: 'center',
                  color: '#666',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  fontSize: 14,
                }}
              >
                Watch Tower — BitConnect Firewall Scan
              </div>
            </div>

            {/* Video Content */}
            <div style={{ flex: 1, backgroundColor: '#000', position: 'relative' }}>
              <Video
                src={staticFile('demo1-optimized.mp4')}
                style={{ width: '100%', height: '100%' }}
                muted
                playbackRate={1.65}
              />
            </div>
          </div>
        </AbsoluteFill>

        {/* Subtle reflection below window */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: '50%',
            transform: 'translateX(-50%) scaleY(-1)',
            width: 1440,
            height: 200,
            background: 'linear-gradient(to bottom, rgba(0,240,255,0.02), transparent)',
            filter: 'blur(20px)',
            opacity: interpolate(windowY, [0, 1], [0, 0.3]),
          }}
        />

        <Particles count={20} color="#00f0ff" speed={0.15} />
        <FilmGrain />
        <Subtitles
          position="top"
          cues={[
            { text: 'LIVE DEMO · BitConnect · MCP Firewall Scan', startFrame: 42, endFrame: 120 },
            { text: 'Watch Tower reports CAUTION: elevated risk, not a hard block.', startFrame: 135, endFrame: 285 },
            { text: 'The agent receives REVIEW and pauses the opportunity for policy review.', startFrame: 300, endFrame: 470 },
          ]}
        />
      </AbsoluteFill>
    </CrossFade>
  );
};
