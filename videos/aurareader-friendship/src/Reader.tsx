import {
  C,
  Icon,
  data,
  sans,
  serif,
  tween,
  typed,
  cursorVisible,
  Pointer,
} from "./design";
import pages from "./reading-pages.json";
import { READING } from "./layout";
export function Reader({ t, book }: { t: number; book: 0 | 1 }) {
  const page = pages[book];
  const m = data.materials[book],
    start = book === 0 ? 11.55 : 18.7,
    select = book === 0 ? 12.25 : 20,
    highlight = book === 0 ? 12.9 : 20.5,
    note = book === 0 ? 13.55 : 21,
    finish = book === 0 ? 15.5 : 22.65,
    link = book === 0 ? 16.4 : 23.1;
  const selection =
      tween(t, select, select + 0.25) *
      (1 - tween(t, highlight, highlight + 0.2)),
    highlighted = tween(t, highlight, highlight + 0.4),
    typedNote = typed(m.note, t, note + 0.12, finish - 0.15),
    quoteTop = page.quoteTop;
  const noteTop = quoteTop + 10;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        opacity: tween(t, start, start + 0.55),
        translate: `${tween(t, start, start + 0.6, 36, 0)}px 0`,
        fontFamily: sans,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: READING.left,
          top: 180,
          width: READING.width,
          color: C.ink,
        }}
      >
        <div
          style={{
            fontSize: 15,
            letterSpacing: 1.7,
            color: C.muted,
            textTransform: "uppercase",
            marginBottom: 14,
          }}
        >
          {book === 0 ? "CHAPTER VIII" : "GOLDEN RULE NUMBER VII"}
        </div>
        <div
          style={{
            fontFamily: serif,
            fontSize: 30,
            fontWeight: 500,
            lineHeight: 1.35,
            marginBottom: 20,
          }}
        >
          {book === 0
            ? "Anne’s Bringing-up Is Begun"
            : "The Art of Conversation"}
        </div>
      </div>
      <div
        data-reading-body={book}
        style={{
          position: "absolute",
          left: READING.left,
          top: READING.top,
          width: READING.width,
          fontFamily: serif,
          fontSize: READING.fontSize,
          lineHeight: `${READING.lineHeight}px`,
          color: C.ink,
        }}
      >
        {page.paragraphs.map((paragraph, index) => {
          const at = paragraph.indexOf(m.quote);
          return (
            <p
              key={index}
              data-reading-paragraph
              style={{ margin: `0 0 ${READING.paragraphGap}px` }}
            >
              {at < 0 ? (
                paragraph
              ) : (
                <>
                  {paragraph.slice(0, at)}
                  <span
                    style={{
                      background:
                        selection > 0
                          ? `rgba(59,130,246,${selection * 0.28})`
                          : `rgba(254,240,138,${highlighted * 0.75})`,
                      boxDecorationBreak: "clone",
                      borderBottom:
                        t >= note
                          ? "2px solid #d95353"
                          : "2px solid transparent",
                    }}
                  >
                    {m.quote}
                  </span>
                  {paragraph.slice(at + m.quote.length)}
                </>
              )}
            </p>
          );
        })}
      </div>
      {t > select && t < note && (
        <div
          style={{
            position: "absolute",
            left: 885,
            top: quoteTop - 54,
            display: "flex",
            alignItems: "center",
            gap: 22,
            padding: "12px 18px",
            background: "#1e293b",
            color: "white",
            borderRadius: 9,
            fontSize: 17,
            boxShadow: "0 6px 20px #00000020",
          }}
        >
          <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Icon name="pen" size={18} />
            高亮
          </span>
          <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Icon name="note" size={18} />
            笔记
          </span>
        </div>
      )}
      <div
        style={{
          position: "absolute",
          left: 1435,
          top: noteTop,
          width: 280,
          borderLeft: "1px solid #e5e6eb",
          paddingLeft: 25,
          opacity: tween(t, note, note + 0.3),
          translate: `0 ${tween(t, note, note + 0.45, 12, 0)}px`,
        }}
      >
        <div
          style={{
            fontSize: 24,
            lineHeight: 1.6,
            color: "#66717e",
            minHeight: 100,
          }}
        >
          {typedNote}
          {t < finish && t > note && cursorVisible(t) && (
            <span
              style={{
                display: "inline-block",
                width: 2,
                height: 25,
                marginLeft: 2,
                background: "#d95353",
                verticalAlign: -3,
              }}
            />
          )}
        </div>
        {t >= finish && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
              marginTop: 16,
              color: t >= link ? C.action : "#86909c",
              fontSize: 19,
            }}
          >
            <Icon name={t >= link ? "check" : "link"} size={20} />
            {t >= link ? "Linked" : "Goal"}
            <span style={{ color: "#a1aab6", marginLeft: 17 }}>
              <Icon name="trash" size={19} />
            </span>
          </div>
        )}
      </div>
      <div
        style={{
          position: "absolute",
          left: 700,
          top: 982,
          right: 150,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          color: "#86909c",
          fontSize: 13,
        }}
      >
        <Icon name="chevron" size={17} />
        <span>
          {book === 0
            ? "Anne of Green Gables"
            : "The Art of Conversation: Twelve Golden Rules"}
        </span>
        <Icon name="chevron" size={17} />
      </div>
      {t >= finish && t < link + 0.5 && (
        <Pointer
          x={1470}
          y={noteTop + 130}
          click={t > link - 0.2 && t < link + 0.1}
          opacity={1 - tween(t, link + 0.2, link + 0.5)}
        />
      )}
    </div>
  );
}
