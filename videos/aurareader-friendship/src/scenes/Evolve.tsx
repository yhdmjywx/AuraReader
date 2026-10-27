import { useCurrentFrame, useVideoConfig } from "remotion";
import { Canvas, C, Icon, Pointer, data, tween } from "../design";
import { Reader } from "../Reader";
export const EvolveScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = 18 + frame / fps;
  return (
    <Canvas t={t} title="Let your Goal evolve." number="05">
      {t < 18.85 && <Reader t={t} book={0} />}
      {t >= 18.7 && <Reader t={t} book={1} />}
      {t < 19.5 && (
        <div
          style={{
            position: "absolute",
            left: 1115,
            top: 362,
            width: 620,
            padding: "23px 25px",
            background: "white",
            boxShadow: "0 12px 35px #00000020",
            border: `1px solid ${C.line}`,
            borderRadius: 12,
            opacity: tween(t, 18.05, 18.3) * (1 - tween(t, 19.1, 19.5)),
          }}
        >
          <div style={{ fontSize: 17, color: C.muted, marginBottom: 14 }}>
            书库
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              fontSize: 22,
              padding: "12px 0",
            }}
          >
            <Icon name="book" color={C.blue} />
            {data.materials[0].title}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              fontSize: 21,
              padding: "15px 12px",
              borderRadius: 8,
              background: C.selected,
              color: C.ink,
            }}
          >
            <Icon name="book" color={C.blue} />
            {data.materials[1].title}
          </div>
        </div>
      )}
      {t < 19.45 && (
        <Pointer
          x={1390}
          y={524}
          click={t > 18.75 && t < 18.95}
          opacity={tween(t, 18.2, 18.5) * (1 - tween(t, 19.15, 19.45))}
        />
      )}
      {t > 25.5 && t < 26 && <Pointer x={320} y={513} click={t > 25.7} />}
    </Canvas>
  );
};
