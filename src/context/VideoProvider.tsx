import React, { useState } from "react";
import { VideoContext } from "./VideoContext";

export const VideoProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [playingId, setPlayingId] = useState<string | null>(null);

  return (
    <VideoContext.Provider value={{ playingId, setPlayingId }}>
      {children}
    </VideoContext.Provider>
  );
};
