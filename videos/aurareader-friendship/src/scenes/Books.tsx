import { useCurrentFrame, useVideoConfig } from "remotion";
import { Canvas, C, Icon, Pointer, data, tween } from "../design";
import { Reader } from "../Reader";
export const BooksScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = 7 + frame / fps;
  return (
    <Canvas t={t} title="Add books to your Goal." number="03">
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 1 - tween(t, 10.9, 11.7),
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 228,
            top: 371,
            color: C.action,
            display: "flex",
            gap: 23,
          }}
        >
          <Icon name="home" />
          <Icon name="up" />
        </div>
        <div
          style={{
            position: "absolute",
            left: 1660,
            top: 417,
            width: 50,
            height: 50,
            borderRadius: 9,
            background: C.selected,
            color: C.action,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="book" size={27} />
          <span
            style={{ position: "absolute", right: 2, bottom: 0, fontSize: 20 }}
          >
            +
          </span>
        </div>
        <div
          style={{
            position: "absolute",
            left: 228,
            top: 574,
            fontSize: 19,
            color: C.muted,
            fontWeight: 600,
          }}
        >
          Books
        </div>
        {t < 8.8 && t > 7.35 && (
          <div
            style={{
              position: "absolute",
              left: 1130,
              top: 490,
              width: 576,
              padding: 25,
              borderRadius: 12,
              background: "white",
              border: `1px solid ${C.line}`,
              boxShadow: "0 16px 50px #00000015",
              opacity: tween(t, 7.35, 7.6),
            }}
          >
            <div style={{ fontSize: 23, fontWeight: 600, marginBottom: 22 }}>
              Add a book
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 15,
                fontSize: 20,
              }}
            >
              <span>{data.materials[0].title}</span>
              <span
                style={{
                  padding: "7px 15px",
                  borderRadius: 6,
                  border: `1px solid ${C.line}`,
                  color: C.action,
                }}
              >
                Add
              </span>
            </div>
          </div>
        )}
        <div
          style={{
            position: "absolute",
            left: 228,
            top: 620,
            width: 220,
            opacity: tween(t, 8.75, 9.2),
            translate: `${tween(t, 8.75, 9.45, 38, 0)}px 0`,
          }}
        >
          <div
            style={{
              height: 220,
              borderRadius: 9,
              background: C.selected,
              border: `1px solid ${C.line}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#64748b",
            }}
          >
            <Icon name="book" size={55} />
          </div>
          <div style={{ fontSize: 24, lineHeight: 1.4, marginTop: 14 }}>
            {data.materials[0].title}
          </div>
          <div style={{ fontSize: 16, color: C.muted, marginTop: 6 }}>EPUB</div>
        </div>
        <Pointer
          x={
            t < 8.8
              ? tween(t, 7.6, 8.3, 1682, 1645)
              : tween(t, 8.85, 10.1, 1645, 345)
          }
          y={
            t < 8.8
              ? tween(t, 7.6, 8.3, 444, 599)
              : tween(t, 8.85, 10.1, 599, 731)
          }
          click={
            (t > 7.45 && t < 7.6) ||
            (t > 8.55 && t < 8.75) ||
            (t > 10.55 && t < 10.75)
          }
          opacity={1 - tween(t, 10.8, 11.2)}
        />
      </div>
      {t >= 11.55 && <Reader t={t} book={0} />}
    </Canvas>
  );
};
