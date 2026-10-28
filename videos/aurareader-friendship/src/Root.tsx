import { Composition, Folder } from "remotion";
import { FriendshipFilm } from "./Film";
import { IdeaScene } from "./scenes/Idea";
import { CreateScene } from "./scenes/Create";
import { BooksScene } from "./scenes/Books";
import { ReadScene } from "./scenes/Read";
import { EvolveScene } from "./scenes/Evolve";
import { DestinyScene } from "./scenes/Destiny";
import { BrandScene } from "./scenes/Brand";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="AuraReaderFriendship"
        component={FriendshipFilm}
        durationInFrames={1170}
        fps={30}
        width={1920}
        height={1080}
      />
      <Folder name="Scenes">
        <Composition
          id="Idea"
          component={IdeaScene}
          durationInFrames={90}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="CreateGoal"
          component={CreateScene}
          durationInFrames={120}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="AddBooks"
          component={BooksScene}
          durationInFrames={150}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="ReadHighlightThink"
          component={ReadScene}
          durationInFrames={180}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="GoalEvolves"
          component={EvolveScene}
          durationInFrames={330}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="GoalDestiny"
          component={DestinyScene}
          durationInFrames={180}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="AuraReaderBrand"
          component={BrandScene}
          durationInFrames={120}
          fps={30}
          width={1920}
          height={1080}
        />
      </Folder>
    </>
  );
};
