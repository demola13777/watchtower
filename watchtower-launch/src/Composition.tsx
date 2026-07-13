import { AbsoluteFill, Sequence } from "remotion";
import { Scene1Problem } from "./scenes/Scene1Problem";
import { Scene2Vulnerability } from "./scenes/Scene2Vulnerability";
import { Scene3Intro } from "./scenes/Scene3Intro";
import { Scene4Engine } from "./scenes/Scene4Engine";
import { Scene5FirewallDemo } from "./scenes/Scene5FirewallDemo";
import { Scene6DeepScanDemo } from "./scenes/Scene6DeepScanDemo";
import { Scene7GlassCockpit } from "./scenes/Scene7GlassCockpit";
import { Scene8DevExp } from "./scenes/Scene8DevExp";
import { Scene9Outro } from "./scenes/Scene9Outro";
import { TransitionPulse } from "./components/TransitionPulse";
import { AudioMix } from "./components/AudioMix";

/**
 * Watch Tower: Cinematic Launch Trailer
 *
 * Timeline @ 30fps:
 * Scene 1 (The Problem):           0:00 - 0:07  |    0 - 210
 * Scene 2 (The Vulnerability):     0:07 - 0:18  |  210 - 525
 * Scene 3 (Introducing WT):        0:18 - 0:28  |  525 - 840
 * Scene 4 (How it Works):          0:28 - 0:38  |  840 - 1140
 * Scene 5 (Firewall Demo):         0:38 - 0:55  | 1140 - 1635
 * Scene 6 (Deep Scan Demo):        0:55 - 1:09  | 1635 - 2070
 * Scene 7 (Glass Cockpit):         1:09 - 1:22  | 2070 - 2475
 * Scene 8 (Dev Experience):        1:22 - 1:32  | 2475 - 2775
 * Scene 9 (Outro):                 1:32 - 1:42  | 2775 - 3060
 */
export const Main = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#050510" }}>
      {/* Scene 1: The Problem (0:00 - 0:07) */}
      <Sequence durationInFrames={210}>
        <Scene1Problem />
      </Sequence>
      {/* Scene 2: The Vulnerability (0:07 - 0:18) */}
      <Sequence from={210} durationInFrames={315}>
        <Scene2Vulnerability />
      </Sequence>
      {/* Scene 3: Introducing Watch Tower (0:18 - 0:28) */}
      <Sequence from={525} durationInFrames={315}>
        <Scene3Intro />
      </Sequence>
      {/* Scene 4: The Threat Intelligence Engine (0:28 - 0:38) */}
      <Sequence from={840} durationInFrames={209}>
        <Scene4Engine />
      </Sequence>
      {/* Scene 5: Real Agent Demo - Firewall Scan (0:38 - 0:55) */}
      <Sequence from={1048} durationInFrames={408}>
        <Scene5FirewallDemo />
      </Sequence>
      {/* Scene 6: Real Agent Demo - Deep Scan & x402 (0:55 - 1:09) */}
      <Sequence from={1466} durationInFrames={435}>
        <Scene6DeepScanDemo />
      </Sequence>
      {/* Scene 7: The Glass Cockpit - Web UI Showcase (1:09 - 1:22) */}
      <Sequence from={1894} durationInFrames={586}>
        <Scene7GlassCockpit />
      </Sequence>
      {/* Scene 8: Developer Experience & X Layer (1:22 - 1:32) */}
      <Sequence from={2315} durationInFrames={463}>
        <Scene8DevExp />
      </Sequence>
      {/* Scene 9: Outro (1:32 - 1:42) */}
      <Sequence from={2775} durationInFrames={285}>
        <Scene9Outro />
      </Sequence>
      <TransitionPulse />
      <AudioMix />
    </AbsoluteFill>
  );
};
