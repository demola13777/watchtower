import React from 'react';
import { Audio, Sequence, staticFile } from 'remotion';

const MUSIC_DURATION = 2523;
const LOOP_START = 2460;
const LOOP_CROSSFADE = MUSIC_DURATION - LOOP_START;
const MASTER_DURATION = 3060;

const clamp = (value: number) => Math.min(1, Math.max(0, value));

const musicLevel = (frame: number) => {
  const fadeIn = clamp(frame / 45);
  const outroFade = clamp((MASTER_DURATION - frame) / 105);
  const baseLevel = frame < 525
    ? 0.09
    : frame < 1140
      ? 0.065
      : frame < 2070
        ? 0.075
        : frame < 2775
          ? 0.065
          : 0.1;

  return baseLevel * fadeIn * outroFade;
};

export const AudioMix: React.FC = () => {
  return (
    <>
      <Audio src={staticFile('voiceover.mp3')} />

      <Sequence durationInFrames={MUSIC_DURATION}>
        <Audio
          src={staticFile('bgm.mp3')}
          volume={(frame) => musicLevel(frame) * clamp((MUSIC_DURATION - frame) / LOOP_CROSSFADE)}
        />
      </Sequence>

      <Sequence from={LOOP_START} durationInFrames={MASTER_DURATION - LOOP_START}>
        <Audio
          src={staticFile('bgm.mp3')}
          volume={(frame) => musicLevel(frame + LOOP_START) * clamp(frame / LOOP_CROSSFADE)}
        />
      </Sequence>
    </>
  );
};
