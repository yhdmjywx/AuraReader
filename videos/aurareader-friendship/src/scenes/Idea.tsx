import { useCurrentFrame, useVideoConfig } from "remotion";
import { Canvas, typed, tween } from "../design";
export const IdeaScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  return (
    <Canvas t={t} title="I have an idea." number="01">
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#f8fafc",
          fontSize: 112,
          letterSpacing: -5,
          fontWeight: 500,
          opacity: tween(t, 0.2, 0.6) * (1 - tween(t, 2.1, 2.7)),
          scale: tween(t, 1.9, 2.75, 1, 0.6),
          translate: `0 ${tween(t, 1.9, 2.75, 0, -24)}px`,
        }}
      >
        {typed("I have an idea.", t, 0.3, 1.3)}
      </div>
    </Canvas>
  );
};
