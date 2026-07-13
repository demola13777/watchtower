import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Img,
  staticFile,
} from "remotion";
import { Particles } from "../components/Particles";
import { Subtitles } from "../components/Subtitles";
import { FilmGrain } from "../components/FilmGrain";
import { CrossFade } from "../components/CrossFade";

export const Scene9Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Logo snap
  const logoScale = spring({ frame: frame - 30, fps, config: { damping: 12 } });
  const logoOpacity = interpolate(frame, [30, 45], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Pulsing glow
  const glowIntensity = 0.5 + Math.sin(frame * 0.06) * 0.3;

  // Title
  const titleOpacity = interpolate(frame, [60, 80], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleY = interpolate(frame, [60, 80], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Subtitle line
  const subOpacity = interpolate(frame, [90, 110], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const subY = interpolate(frame, [90, 110], [15, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Final fade to black
  const fadeOut = interpolate(frame, [235, 285], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <CrossFade durationInFrames={285} fadeOut={50}>
      <AbsoluteFill
        style={{
          backgroundColor: "#000000",
          background:
            "radial-gradient(circle at 50% 45%, rgba(10, 25, 47, 0.5) 0%, #000000 50%)",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          {/* Logo */}
          <Img
            src={staticFile("watchtower_logo.png")}
            style={{
              width: 300,
              height: 300,
              opacity: logoOpacity,
              transform: `scale(${Math.min(logoScale, 1)})`,
              clipPath: "inset(12% 12% 12% 12% round 18%)",
              filter: `drop-shadow(0 0 80px rgba(0, 240, 255, ${glowIntensity}))`,
            }}
          />

          {/* Title */}
          <h1
            style={{
              fontFamily: "Inter, system-ui, sans-serif",
              fontSize: 56,
              fontWeight: 800,
              color: "#ffffff",
              letterSpacing: 4,
              margin: "30px 0 0 0",
              opacity: titleOpacity,
              transform: `translateY(${titleY}px)`,
            }}
          >
            Watch Tower
          </h1>

          {/* URL + Built for */}
          <p
            style={{
              fontFamily: "Inter, system-ui, sans-serif",
              fontSize: 24,
              fontWeight: 400,
              color: "#888888",
              margin: "16px 0 0 0",
              opacity: subOpacity,
              transform: `translateY(${subY}px)`,
            }}
          >
            watchtowr.xyz • Built for X Layer
          </p>
        </div>

        <Particles count={30} color="#00f0ff" speed={0.15} />
        <FilmGrain />
        <Subtitles
          cues={[
            {
              text: "Build agents that trade faster.",
              startFrame: 8,
              endFrame: 80,
            },
            {
              text: "More importantly: build agents that know when not to trade.",
              startFrame: 90,
              endFrame: 185,
            },
          ]}
        />

        {/* Final fade to absolute black */}
        <AbsoluteFill
          style={{
            backgroundColor: "#000000",
            opacity: fadeOut,
            pointerEvents: "none",
          }}
        />
      </AbsoluteFill>
    </CrossFade>
  );
};
