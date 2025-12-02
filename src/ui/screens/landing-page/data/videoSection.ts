import avatarVideo from "@/assets/video/avatar_video.mp4";

export type VideoItem = {
  id: number;
  title: string;
  src: string;
  quote: string;
  author: string;
};

export const videos: VideoItem[] = [
  {
    id: 1,
    title: "AI personas can make you high passive income",
    src: avatarVideo,
    quote: "My girlfriend AI made me a 24-year-old millionaire",
    author: "@CARYN MARJORIE",
  },
  {
    id: 2,
    title: "Turn fan attention into real revenue",
    src: avatarVideo,
    quote: "I scaled my content income without burning out.",
    author: "@TOP CREATOR",
  },
  {
    id: 3,
    title: "Let your AI persona work while you sleep",
    src: avatarVideo,
    quote: "I wake up to new conversations — and new sales.",
    author: "@GLOBAL STREAMER",
  },
];
