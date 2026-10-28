import { Series, useVideoConfig } from "remotion";
import { IdeaScene } from "./scenes/Idea";
import { CreateScene } from "./scenes/Create";
import { BooksScene } from "./scenes/Books";
import { ReadScene } from "./scenes/Read";
import { EvolveScene } from "./scenes/Evolve";
import { DestinyScene } from "./scenes/Destiny";
import { BrandScene } from "./scenes/Brand";
export const FriendshipFilm = () => {
  const { fps } = useVideoConfig();
  return (
    <Series>
      <Series.Sequence
        name="01 · I want to make a new friend"
        durationInFrames={3 * fps}
        premountFor={fps}
      >
        <IdeaScene />
      </Series.Sequence>
      <Series.Sequence
        name="02 · Create a Goal"
        durationInFrames={4 * fps}
        premountFor={fps}
      >
        <CreateScene />
      </Series.Sequence>
      <Series.Sequence
        name="03 · Add books"
        durationInFrames={5 * fps}
        premountFor={fps}
      >
        <BooksScene />
      </Series.Sequence>
      <Series.Sequence
        name="04 · Read. Highlight. Think."
        durationInFrames={6 * fps}
        premountFor={fps}
      >
        <ReadScene />
      </Series.Sequence>
      <Series.Sequence
        name="05 · Let your Goal evolve"
        durationInFrames={11 * fps}
        premountFor={fps}
      >
        <EvolveScene />
      </Series.Sequence>
      <Series.Sequence
        name="06 · Every Goal has its own destiny"
        durationInFrames={6 * fps}
        premountFor={fps}
      >
        <DestinyScene />
      </Series.Sequence>
      <Series.Sequence
        name="07 · Your reading. Your direction."
        durationInFrames={4 * fps}
        premountFor={fps}
      >
        <BrandScene />
      </Series.Sequence>
    </Series>
  );
};
