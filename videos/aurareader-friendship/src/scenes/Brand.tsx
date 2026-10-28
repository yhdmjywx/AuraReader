import { useCurrentFrame, useVideoConfig } from "remotion";
import { Brand, Canvas, tween } from "../design";
export const BrandScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = 35 + frame / fps;
  return (
    <Canvas t={t} title="AuraReader" number="07">
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          opacity: tween(t, 35.15, 35.85),
          translate: `0 ${tween(t, 35.15, 36, 16, 0)}px`,
        }}
      >
        <Brand size={106} light />
        <div
          style={{
            fontSize: 43,
            color: "#b8c5d8",
            letterSpacing: -1.1,
            marginTop: 37,
          }}
        >
          Your reading. Your direction.
        </div>
      </div>
    </Canvas>
  );
};
