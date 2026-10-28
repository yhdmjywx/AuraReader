import { useCurrentFrame, useVideoConfig } from "remotion";
import { Canvas, data } from "../design";
export const IdeaScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  return <Canvas t={t} title={data.initialGoal} number="01" />;
};
