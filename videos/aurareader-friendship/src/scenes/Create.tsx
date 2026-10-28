import { useCurrentFrame, useVideoConfig } from "remotion";
import { Canvas, C, Pointer, tween, Icon } from "../design";
export const CreateScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = 3 + frame / fps;
  return (
    <Canvas t={t} title="Create a Goal." number="02">
      <div
        style={{
          position: "absolute",
          left: 540,
          top: 590,
          display: "flex",
          gap: 23,
          alignItems: "center",
          opacity: tween(t, 3.35, 3.65) * (1 - tween(t, 5.1, 5.5)),
        }}
      >
        <div
          style={{
            background: C.selected,
            color: C.action,
            padding: "13px 24px",
            borderRadius: 8,
            fontSize: 24,
          }}
        >
          Create
        </div>
        <div style={{ fontSize: 21, color: C.muted }}>Cancel</div>
      </div>
      {t > 5.2 && (
        <div
          style={{
            position: "absolute",
            left: 445,
            top: 176,
            color: C.action,
            display: "flex",
            gap: 23,
            opacity: tween(t, 5.2, 5.7),
          }}
        >
          <Icon name="home" />
          <Icon name="up" />
        </div>
      )}
      {t > 5.2 && (
        <div
          style={{
            position: "absolute",
            left: 445,
            top: 390,
            color: C.muted,
            fontSize: 24,
            opacity: tween(t, 5.25, 5.8),
          }}
        >
          Add a book to read for this goal.
        </div>
      )}
      <Pointer
        x={tween(t, 5.3, 5.95, 600, 930)}
        y={tween(t, 5.3, 5.95, 618, 290)}
        click={(t > 5.06 && t < 5.24) || (t > 6 && t < 6.2)}
        opacity={tween(t, 4.85, 5.05) * (1 - tween(t, 6.5, 6.9))}
      />
    </Canvas>
  );
};
