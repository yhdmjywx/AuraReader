import { useCurrentFrame, useVideoConfig } from "remotion";
import { Canvas, C, Icon, Pointer, data, tween } from "../design";
import { Reader } from "../Reader";
import { BookCover } from "../BookCover";
export const BooksScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = 7 + frame / fps;
  const firstPicker = t > 7.35 && t < 8.12;
  const secondPicker = t > 8.48 && t < 9.15;
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
            left: 445,
            top: 176,
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
            left: 1690,
            top: 250,
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
            left: 445,
            top: 390,
            fontSize: 19,
            color: C.muted,
            fontWeight: 600,
          }}
        >
          Books
        </div>
        {(firstPicker || secondPicker) && (
          <div
            style={{
              position: "absolute",
              left: 1120,
              top: 330,
              width: 620,
              padding: 25,
              borderRadius: 12,
              background: "white",
              border: `1px solid ${C.line}`,
              boxShadow: "0 16px 50px #00000015",
              opacity: firstPicker
                ? tween(t, 7.35, 7.55)
                : tween(t, 8.48, 8.68),
            }}
          >
            <div style={{ fontSize: 23, fontWeight: 600, marginBottom: 22 }}>
              Add a book
            </div>
            <BookChoice index={0} added={t >= 8.04} />
            <BookChoice index={1} added={t >= 9.07} />
          </div>
        )}
        <BookCard index={0} left={445} t={t} from={8.12} />
        <BookCard index={1} left={760} t={t} from={9.15} />
        <Pointer
          x={
            t < 8.12
              ? tween(t, 7.65, 7.9, 1712, 1675)
              : t < 8.48
                ? tween(t, 8.15, 8.38, 1675, 1712)
                : t < 9.15
                  ? tween(t, 8.55, 8.95, 1712, 1675)
                  : tween(t, 9.4, 10.1, 1675, 555)
          }
          y={
            t < 8.12
              ? tween(t, 7.65, 7.9, 275, 439)
              : t < 8.48
                ? tween(t, 8.15, 8.38, 439, 275)
                : t < 9.15
                  ? tween(t, 8.55, 8.95, 275, 517)
                  : tween(t, 9.4, 10.1, 517, 568)
          }
          click={
            (t > 7.45 && t < 7.6) ||
            (t > 7.98 && t < 8.1) ||
            (t > 8.38 && t < 8.5) ||
            (t > 9.0 && t < 9.12) ||
            (t > 10.55 && t < 10.75)
          }
          opacity={1 - tween(t, 10.8, 11.2)}
        />
      </div>
      {t >= 11.55 && <Reader t={t} book={0} />}
    </Canvas>
  );
};

const BookChoice = ({ index, added }: { index: 0 | 1; added: boolean }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 15,
      padding: "7px 0",
      minHeight: 64,
    }}
  >
    <BookCover index={index} width={44} height={60} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 19, lineHeight: 1.3 }}>
        {data.materials[index].title}
      </div>
      <div style={{ fontSize: 13, color: C.muted, marginTop: 5 }}>
        {data.materials[index].author}
      </div>
    </div>
    <div
      style={{
        padding: "7px 13px",
        borderRadius: 6,
        border: `1px solid ${C.line}`,
        color: added ? C.muted : C.action,
        fontSize: 18,
      }}
    >
      {added ? "Added" : "Add"}
    </div>
  </div>
);

const BookCard = ({
  index,
  left,
  t,
  from,
}: {
  index: 0 | 1;
  left: number;
  t: number;
  from: number;
}) => (
  <div
    style={{
      position: "absolute",
      left,
      top: 430,
      width: 220,
      opacity: tween(t, from, from + 0.35),
      translate: `${tween(t, from, from + 0.5, 28, 0)}px 0`,
    }}
  >
    <BookCover index={index} />
    <div style={{ fontSize: 22, lineHeight: 1.4, marginTop: 14 }}>
      {data.materials[index].title}
    </div>
    <div
      style={{ fontSize: 15, lineHeight: 1.4, color: C.muted, marginTop: 7 }}
    >
      {data.materials[index].author}
    </div>
    <div style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>EPUB</div>
  </div>
);
