import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Video, staticFile } from 'remotion';
import { Particles } from '../components/Particles';
import { Subtitles } from '../components/Subtitles';
import { FilmGrain } from '../components/FilmGrain';
import { CrossFade } from '../components/CrossFade';

export const Scene6DeepScanDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Scene label
  const labelOpacity = interpolate(frame, [0, 10, 25, 45], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Browser window slides from right
  const windowX = spring({ frame: frame - 20, fps, config: { damping: 15, mass: 1.1 } });
  const windowTranslateX = interpolate(windowX, [0, 1], [1920, 0]);

  // x402 overlay animation, timed to the accelerated demo playback.
  const overlayY = spring({ frame: frame - 230, fps, config: { damping: 12 } });
  const overlayTranslateY = interpolate(overlayY, [0, 1], [-180, 0]);
  const overlayOpacity = interpolate(frame, [230, 245, 340, 360], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <CrossFade durationInFrames={435}>
      <AbsoluteFill
        style={{
          background: 'radial-gradient(ellipse at 50% 30%, #0a1628 0%, #050510 70%)',
        }}
      >
        {/* Scene Label */}
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', opacity: labelOpacity }}>
          <div style={{ textAlign: 'center' }}>
            <h1
              style={{
                fontFamily: 'Inter, system-ui, sans-serif',
                fontSize: 80,
                fontWeight: 900,
                color: '#1eff78',
                margin: 0,
                textShadow: '0 0 40px rgba(30, 255, 120, 0.5)',
              }}
            >
              DEMO 2
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
              PEPE — EXECUTE
            </p>
          </div>
        </AbsoluteFill>

        {/* Browser Window */}
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
          <div
            style={{
              transform: `translateX(${windowTranslateX}px)`,
              width: 1440,
              height: 820,
              borderRadius: 20,
              overflow: 'hidden',
              boxShadow: '0 30px 80px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.05)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
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
                Watch Tower — PEPE Deep Scan & x402
              </div>
            </div>

            <div style={{ flex: 1, backgroundColor: '#000', position: 'relative' }}>
              <Video
                src={staticFile('demo2-optimized.mp4')}
                style={{ width: '100%', height: '100%' }}
                muted
                startFrom={120}
                playbackRate={1.6}
              />
            </div>
          </div>
        </AbsoluteFill>

        {/* x402 Payment Overlay */}
        <div
          style={{
            position: 'absolute',
            top: 120,
            left: '50%',
            transform: `translate(-50%, ${overlayTranslateY}px)`,
            opacity: overlayOpacity,
            backgroundColor: 'rgba(30, 255, 120, 0.12)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(30, 255, 120, 0.3)',
            padding: '18px 36px',
            borderRadius: 50,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            boxShadow: '0 20px 50px rgba(30, 255, 120, 0.1)',
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              backgroundColor: '#1eff78',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <span
            style={{
              fontFamily: 'Inter, system-ui, sans-serif',
              fontSize: 24,
              fontWeight: 700,
              color: '#ffffff',
              whiteSpace: 'nowrap',
            }}
          >
            x402 Payment Settled on X Layer
          </span>
        </div>

        <Particles count={20} color="#00f0ff" speed={0.15} />
        <FilmGrain />
        <Subtitles
          position="top"
          cues={[
            { text: 'LIVE DEMO · PEPE · Deep Scan + x402 settlement', startFrame: 42, endFrame: 118 },
            { text: 'The agent settles for intelligence with USDT on X Layer.', startFrame: 128, endFrame: 215 },
            { text: 'The PEPE report returns EXECUTE. The agent proceeds under its policy.', startFrame: 285, endFrame: 420 },
          ]}
        />
      </AbsoluteFill>
    </CrossFade>
  );
};
