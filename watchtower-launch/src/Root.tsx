import { Composition } from 'remotion';
import { Main } from './Composition';
import './index.css';

// Total duration: 1:42 (3060 frames) @ 30fps, 1080p
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="WatchTowerLaunch"
        component={Main}
        durationInFrames={3060}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
