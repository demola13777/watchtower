import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  Img,
  staticFile,
  Sequence,
} from "remotion";
import { Subtitles } from "../components/Subtitles";
import { FilmGrain } from "../components/FilmGrain";
import { CrossFade } from "../components/CrossFade";

interface PanImageProps {
  src: string;
  duration: number;
  label: string;
}

const PanImage: React.FC<PanImageProps> = ({ src, duration, label }) => {
  const frame = useCurrentFrame();

  const scale = interpolate(frame, [0, duration], [1, 1.18], {
    extrapolateRight: "clamp",
  });
  const translateX = interpolate(frame, [0, duration], [0, -40], {
    extrapolateRight: "clamp",
  });
  const translateY = interpolate(frame, [0, duration], [0, -25], {
    extrapolateRight: "clamp",
  });

  // Label fade
  const labelOpacity = interpolate(
    frame,
    [10, 25, duration - 30, duration - 10],
    [0, 0.6, 0.6, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "#000" }}>
      <Img
        src={staticFile(src)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${scale}) translate(${translateX}px, ${translateY}px)`,
        }}
        durationInFrames={165}
      />
      {/* Dark vignette */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 40%, rgba(0, 0, 0, 0.85) 100%)",
        }}
      />
      {/* Scene label */}
      <div
        style={{
          position: "absolute",
          bottom: 140,
          left: 60,
          opacity: labelOpacity,
        }}
      >
        <div
          style={{
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            padding: "10px 24px",
            borderRadius: 8,
          }}
        >
          <span
            style={{
              fontFamily: "Inter, system-ui, sans-serif",
              fontSize: 20,
              fontWeight: 600,
              color: "rgba(255, 255, 255, 0.7)",
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            {label}
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const Scene7GlassCockpit: React.FC = () => {
  return (
    <CrossFade durationInFrames={405}>
      <AbsoluteFill style={{ backgroundColor: "#050510" }}>
        {/* Screenshot 1: Homepage */}
        <Sequence durationInFrames={152}>
          <PanImage src="Homepage.png" duration={135} label="Command Center" />
          <Subtitles
            cues={[
              {
                text: "A glass cockpit for every autonomous decision.",
                startFrame: 8,
                endFrame: 58,
              },
              {
                text: "Real-time telemetry gives operators an instant view of agent activity.",
                startFrame: 64,
                endFrame: 128,
              },
            ]}
          />
        </Sequence>

        {/* Screenshot 2: Network Explorer */}
        <Sequence from={146} durationInFrames={178}>
          <PanImage
            src="Network Explorer.png"
            duration={135}
            label="Network Explorer"
          />
          <Subtitles
            cues={[
              {
                text: "Monitor scans across supported EVM networks in real time.",
                startFrame: 8,
                endFrame: 128,
              },
            ]}
          />
        </Sequence>

        {/* Screenshot 3: Report Page */}
        <Sequence from={314} durationInFrames={111}>
          <PanImage
            src="Report Page.png"
            duration={135}
            label="Threat Intelligence Report"
          />
          <Subtitles
            cues={[
              {
                text: "Every deep scan creates a deterministic, inspectable receipt.",
                startFrame: 8,
                endFrame: 58,
              },
              {
                text: "Anchored on X Layer for an immutable audit trail.",
                startFrame: 64,
                endFrame: 128,
              },
            ]}
          />
        </Sequence>

        <FilmGrain />
      </AbsoluteFill>
    </CrossFade>
  );
};
