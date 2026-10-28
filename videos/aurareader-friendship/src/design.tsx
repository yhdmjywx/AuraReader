import React from "react";
import { Easing, interpolate, staticFile } from "remotion";
import { loadFont } from "@remotion/fonts";
import content from "./content.json";
import { APP } from "./layout";
export const C = {
  navy: "#0f172a",
  ink: "#1d2129",
  muted: "#64748b",
  blue: "#3b82f6",
  action: "#1d4ed8",
  app: "#f5f7fa",
  line: "#e5e6eb",
  selected: "#e8eefb",
};
export const sans = "Inter, sans-serif",
  serif = "Lora, Georgia, serif",
  data = content;
void loadFont({
  family: "Inter",
  url: staticFile("fonts/Inter.ttf"),
  weight: "100 900",
});
void loadFont({
  family: "Lora",
  url: staticFile("fonts/Lora.ttf"),
  weight: "400 700",
});
export const ease = Easing.bezier(0.22, 1, 0.36, 1);
export const tween = (t: number, from: number, to: number, a = 0, b = 1) =>
  interpolate(t, [from, to], [a, b], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
export const linear = (t: number, from: number, to: number, a = 0, b = 1) =>
  interpolate(t, [from, to], [a, b], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
export const typed = (text: string, t: number, from: number, to: number) =>
  text.slice(0, Math.floor(linear(t, from, to, 0, text.length)));
export const cursorVisible = (t: number) => Math.floor(t * 2.4) % 2 === 0;
export function Icon({
  name,
  size = 24,
  color = "currentColor",
}: {
  name: string;
  size?: number;
  color?: string;
}) {
  const paths: Record<string, React.ReactNode> = {
    book: (
      <>
        <path d="M3 4h7a3 3 0 0 1 2 1 3 3 0 0 1 2-1h7v15h-7a3 3 0 0 0-2 1 3 3 0 0 0-2-1H3z" />
        <path d="M12 5v15" />
      </>
    ),
    home: (
      <>
        <path d="m3 11 9-8 9 8M5 10v11h14V10M9 21v-7h6v7" />
      </>
    ),
    up: <path d="m5 10 7-7 7 7M12 3v18" />,
    plus: <path d="M12 4v16M4 12h16" />,
    expand: <path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5" />,
    link: (
      <>
        <path d="m9 15 6-6M8 16l-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0M16 8l1-1a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0" />
      </>
    ),
    note: (
      <>
        <path d="M4 3h16v13l-5 5H4zM15 21v-6h5M8 8h8M8 12h5" />
      </>
    ),
    chevron: <path d="m8 4 8 8-8 8" />,
    down: <path d="m5 9 7 7 7-7" />,
    check: <path d="m4 12 5 5L21 5" />,
    archive: (
      <>
        <path d="M3 3h18v5H3zM5 8v13h14V8M10 12h4" />
      </>
    ),
    trash: (
      <>
        <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" />
      </>
    ),
    folder: <path d="M3 5h7l2 3h9v12H3z" />,
    pen: (
      <>
        <path d="m4 16 12-12 4 4L8 20H4zM14 6l4 4" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      {paths[name] || paths.book}
    </svg>
  );
}
export function Brand({
  size = 28,
  light = false,
}: {
  size?: number;
  light?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: size * 0.35,
        color: light ? "#f8fafc" : C.ink,
        fontFamily: sans,
        fontSize: size,
        fontWeight: 650,
        letterSpacing: -size * 0.035,
      }}
    >
      <svg
        width={size * 1.08}
        height={size * 1.12}
        viewBox="0 0 30 32"
        fill="none"
      >
        <rect x="1" y="2" width="12" height="26" rx="2" fill={C.blue} />
        <rect x="16" y="2" width="12" height="26" rx="2" fill={C.blue} />
        <path d="M14.5 5v26" stroke={C.blue} strokeWidth="1.6" />
      </svg>
      AuraReader
    </div>
  );
}
export function AppChrome({ t, reading }: { t: number; reading: boolean }) {
  return (
    <div
      style={{
        position: "absolute",
        left: APP.left,
        top: APP.top,
        width: APP.width,
        height: APP.height,
        background: C.app,
        borderRadius: 18,
        boxShadow: "0 28px 100px #00000035",
        overflow: "hidden",
        opacity: tween(t, 2.65, 3.2) * (1 - tween(t, 29, 29.8)),
        scale: tween(t, 2.65, 3.35, 0.96, 1),
      }}
    >
      <div
        style={{
          height: APP.header,
          background: "white",
          borderBottom: `1px solid ${C.line}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 27px",
        }}
      >
        <Brand size={26} />
        {reading && (
          <div
            style={{
              position: "absolute",
              left: 350,
              right: 150,
              textAlign: "center",
              fontSize: 18,
              color: C.ink,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 14,
            }}
          >
            <Icon name="book" size={23} />
            {t < 18.8 ? data.materials[0].title : data.materials[1].title}
            <Icon name="down" size={15} />
          </div>
        )}
        <div style={{ display: "flex", gap: 23, color: C.muted }}>
          <Icon name="book" />
          <Icon name="expand" />
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: reading ? APP.sidebar : 12,
          right: 12,
          top: APP.header + 12,
          bottom: 12,
          background: "white",
          borderRadius: 12,
          border: `1px solid ${C.line}`,
        }}
      />
      {reading && (
        <div
          style={{
            position: "absolute",
            left: 24,
            top: 96,
            display: "flex",
            gap: 14,
            color: C.muted,
          }}
        >
          <Icon name="home" />
          <Icon name="up" />
          <span style={{ width: 72 }} />
          <Icon name="plus" color={C.action} />
          <Icon name="expand" />
        </div>
      )}
    </div>
  );
}
export function Caption({
  title,
  number,
  t,
}: {
  title: string;
  number: string;
  t: number;
}) {
  const start =
    Number(number) === 2
      ? 3
      : Number(number) === 3
        ? 7
        : Number(number) === 4
          ? 12
          : Number(number) === 5
            ? 18
            : 29.5;
  if (number === "01" || number === "07") return null;
  const compact = number !== "06";
  const fade =
    number === "04"
      ? 1 - tween(t, 16.8, 17.4)
      : number === "05"
        ? 1 - tween(t, 20.2, 21)
        : 1;
  return (
    <div
      style={{
        position: "absolute",
        left: compact ? 56 : 120,
        top: compact ? 98 : 91,
        width: compact ? 242 : 1640,
        color: "#f8fafc",
        opacity: tween(t, start, start + 0.4) * fade,
        translate: `0 ${tween(t, start, start + 0.55, 12, 0)}px`,
      }}
    >
      <div
        style={{
          fontSize: compact ? 13 : 15,
          letterSpacing: compact ? 2 : 4,
          color: "#91a8d0",
          fontWeight: 550,
          marginBottom: 17,
        }}
      >
        {number} / AURAREADER
      </div>
      <div
        style={{
          fontSize: compact ? 40 : 66,
          fontWeight: 550,
          lineHeight: 1.2,
          letterSpacing: compact ? -1.3 : -3,
        }}
      >
        {title}
      </div>
    </div>
  );
}
function Material({
  index,
  t,
  large,
}: {
  index: number;
  t: number;
  large: boolean;
}) {
  const m = data.materials[index],
    at = index === 0 ? 16.4 : 23.1;
  return (
    <div
      style={{
        opacity: tween(t, at, at + 0.6),
        translate: `0 ${tween(t, at, at + 0.65, 16, 0)}px`,
        display: "flex",
        gap: large ? 15 : 11,
        padding: large ? "22px 24px" : "18px 0",
        border: large ? `1px solid ${C.line}` : "none",
        borderRadius: large ? 12 : 0,
        background: large ? "#f9fafc" : "transparent",
        flex: 1,
        minWidth: 0,
      }}
    >
      <Icon name="note" size={large ? 27 : 22} color={C.muted} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: large ? 29 : 23,
            lineHeight: 1.5,
            color: C.ink,
            fontWeight: 450,
          }}
        >
          {m.note}
        </div>
        <div
          style={{
            fontSize: large ? 17 : 14,
            color: C.muted,
            lineHeight: 1.5,
            marginTop: large ? 12 : 8,
          }}
        >
          {m.title}
        </div>
      </div>
      {!large && <div style={{ color: "#9aa4b3", fontSize: 18 }}>×</div>}
    </div>
  );
}
export function GoalAnchor({ t }: { t: number }) {
  const times = [
    0, 1.9, 2.45, 3.15, 5.5, 6.7, 10.65, 11.75, 28.8, 29.8, 35, 35.55,
  ];
  const lerp = (values: number[]) =>
    interpolate(t, times, values, {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: ease,
    });
  const left = lerp([
      440, 440, 650, 500, 500, 445, 445, 390, 390, 360, 360, 360,
    ]),
    top = lerp([485, 485, 410, 330, 330, 250, 250, 235, 235, 352, 352, 352]),
    width = lerp([
      1160, 1160, 620, 1150, 1150, 1170, 1170, 236, 236, 1200, 1200, 1200,
    ]),
    fontSize = lerp([84, 84, 38, 52, 52, 44, 44, 29, 29, 56, 56, 56]);
  const cardWeight = 1 - tween(t, 5.4, 6.6) + tween(t, 29, 29.8),
    large = t >= 29.45;
  const shellWeight = cardWeight * tween(t, 2.05, 2.6);
  const labelWeight = cardWeight * tween(t, 2.7, 3.15);
  let title =
    t < 25.8
      ? data.initialGoal
      : t < 26.25
        ? data.initialGoal.slice(
            0,
            Math.floor(linear(t, 25.8, 26.25, data.initialGoal.length, 0)),
          )
        : typed(data.evolvedGoal, t, 26.25, 28.2);
  if (t < 1.35) title = typed(data.initialGoal, t, 0.3, 1.35);
  const editing = (t >= 3.15 && t < 5.15) || (t >= 25.8 && t < 28.3),
    count = t >= 23.1 ? 2 : t >= 16.4 ? 1 : 0;
  const materialOpacity =
    t < 29 ? 1 : 1 - tween(t, 29, 29.14) + tween(t, 29.55, 29.9);
  return (
    <div
      data-goal-id={data.goalId}
      style={{
        position: "absolute",
        left,
        top,
        width,
        boxSizing: "border-box",
        color: t < 2.6 && shellWeight < 0.45 ? "#f8fafc" : C.ink,
        opacity: tween(t, 0.2, 0.6) * (1 - tween(t, 35, 35.5)),
        padding: `${36 * shellWeight}px ${40 * shellWeight}px`,
        background: `rgba(255,255,255,${shellWeight})`,
        borderRadius: 18 * shellWeight,
        boxShadow: `0 24px 100px rgba(0,0,0,${shellWeight * 0.125})`,
      }}
    >
      <div
        style={{
          fontSize: 18,
          color: editing ? C.action : C.muted,
          height: 22 * labelWeight,
          opacity: labelWeight,
          overflow: "hidden",
          marginBottom: 17 * labelWeight,
          fontWeight: 500,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Icon name={editing ? "pen" : "folder"} size={22} />
        {t < 5.15 ? "New goal" : "Goal"}
      </div>
      <div
        style={{
          fontSize,
          fontWeight: 600,
          letterSpacing: large ? -1.6 : -0.9,
          lineHeight: 1.3,
          whiteSpace: "pre-wrap",
          minHeight: editing ? fontSize * 1.3 : undefined,
          borderBottom: editing ? `2px solid ${C.blue}` : "none",
          paddingBottom: editing ? 13 : 0,
        }}
      >
        {title}
        {editing && cursorVisible(t) && (
          <span
            style={{
              display: "inline-block",
              height: "0.9em",
              width: 3,
              background: C.blue,
              marginLeft: 3,
              verticalAlign: "-0.05em",
            }}
          />
        )}
      </div>
      {count > 0 && (
        <div style={{ marginTop: large ? 27 : 28, opacity: materialOpacity }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: C.muted,
              fontSize: large ? 18 : 16,
              marginBottom: large ? 16 : 4,
            }}
          >
            {count} {count === 1 ? "item" : "items"}
            <Icon name="down" size={16} />
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: large ? "row" : "column",
              gap: large ? 20 : 0,
            }}
          >
            <Material index={0} t={t} large={large} />
            {count === 2 && <Material index={1} t={t} large={large} />}
          </div>
        </div>
      )}
    </div>
  );
}
export function Pointer({
  x,
  y,
  opacity = 1,
  click = false,
}: {
  x: number;
  y: number;
  opacity?: number;
  click?: boolean;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        opacity,
        filter: "drop-shadow(0 2px 3px #00000025)",
        scale: click ? 0.87 : 1,
        zIndex: 12,
      }}
    >
      <svg width="29" height="36" viewBox="0 0 29 36">
        <path
          d="M2 2 25 19 15 21 10 31Z"
          fill="#101827"
          stroke="white"
          strokeWidth="2"
        />
      </svg>
      {click && (
        <div
          style={{
            position: "absolute",
            left: -12,
            top: -12,
            width: 28,
            height: 28,
            borderRadius: "50%",
            border: "2px solid #3b82f6",
            opacity: 0.65,
          }}
        />
      )}
    </div>
  );
}
export function Canvas({
  t,
  title,
  number,
  children,
}: {
  t: number;
  title: string;
  number: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        fontFamily: sans,
        background: C.navy,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at 48% 120%, #243654 0%, #0f172a 65%)",
        }}
      />
      <Caption title={title} number={number} t={t} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          transformOrigin: "1080px 540px",
          scale:
            1 +
            0.035 * tween(t, 12.1, 14) * (1 - tween(t, 16.8, 18)) +
            0.025 * tween(t, 20, 21.6) * (1 - tween(t, 24.7, 25.7)),
        }}
      >
        <AppChrome t={t} reading={t >= 11.7 && t < 29.45} />
        {children}
        <GoalAnchor t={t} />
      </div>
    </div>
  );
}
