import { useCurrentFrame, useVideoConfig } from "remotion";
import { Canvas, Icon, tween } from "../design";
import { Reader } from "../Reader";
export const DestinyScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = 29 + frame / fps;
  return (
    <Canvas t={t} title="Every Goal has its own destiny." number="06">
      {t < 29.5 && (
        <div style={{ opacity: 1 - tween(t, 29, 29.45) }}>
          <Reader t={t} book={1} />
        </div>
      )}
      <div
        style={{
          position: "absolute",
          left: 360,
          top: 811,
          width: 1200,
          display: "flex",
          gap: 24,
          opacity: tween(t, 30, 30.65),
          translate: `0 ${tween(t, 30, 30.8, 20, 0)}px`,
        }}
      >
        <Choice icon="check" title="Achieve" action="Mark as complete" />
        <Choice icon="archive" title="Archive" action="Archive" />
        <Choice icon="trash" title="Delete" action="Delete…" />
      </div>
    </Canvas>
  );
};
const Choice = ({
  icon,
  title,
  action,
}: {
  icon: string;
  title: string;
  action: string;
}) => (
  <div
    style={{
      flex: 1,
      padding: "23px 28px",
      border: "1px solid #395071",
      borderRadius: 13,
      color: "#f8fafc",
      display: "flex",
      alignItems: "center",
      gap: 20,
    }}
  >
    <Icon name={icon} size={33} color="#91b9ff" />
    <div>
      <div style={{ fontSize: 31, fontWeight: 500, letterSpacing: -0.7 }}>
        {title}
      </div>
      <div style={{ fontSize: 15, color: "#9cacc2", marginTop: 7 }}>
        {action}
      </div>
    </div>
  </div>
);
