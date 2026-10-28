import { CanvasImage, staticFile, useVideoConfig } from "remotion";
import covers from "../public/covers/sources.json";
export function BookCover({
  index,
  width = 220,
  height = 300,
}: {
  index: 0 | 1;
  width?: number;
  height?: number;
}) {
  const { fps } = useVideoConfig();
  return (
    <CanvasImage
      name={covers[index].title + " cover"}
      src={staticFile(covers[index].file)}
      premountFor={fps}
      style={{
        width,
        height,
        display: "block",
        flexShrink: 0,
        objectFit: "contain",
        background: "#fff",
        borderRadius: 6,
        border: "1px solid #e5e6eb",
      }}
    />
  );
}
