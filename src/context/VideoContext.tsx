import { createContext } from "react";

export type VideoContextType = {
  playingId: string | null;
  setPlayingId: (id: string | null) => void;
};

export const VideoContext = createContext<VideoContextType>({
  playingId: null,
  setPlayingId: () => {},
});
