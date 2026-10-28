import { useCurrentFrame, useVideoConfig } from "remotion";
import { Canvas } from "../design";
import { Reader } from "../Reader";
export const ReadScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = 12 + frame / fps;
  const word =
    t < 13.35
      ? "Read."
      : t < 15.5
        ? "Read. Highlight."
        : "Read. Highlight. Think.";
  return (
    <Canvas t={t} title={word} number="04">
      <Reader t={t} book={0} />
    </Canvas>
  );
};
