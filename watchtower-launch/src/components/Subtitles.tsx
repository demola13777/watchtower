import React from 'react';

export interface SubtitleCue {
  text: string;
  startFrame: number;
  endFrame: number;
}

interface SubtitlesProps {
  text?: string;
  startFrame?: number;
  endFrame?: number;
  cues?: SubtitleCue[];
  position?: 'bottom' | 'top';
}

export const Subtitles: React.FC<SubtitlesProps> = () => null;
