import carynVideo from "@/assets/video/carynai-min.mp4";
import carynVideo02 from "@/assets/video/carynai2-min.mp4";

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
    src: carynVideo,
    quote: "My girlfriend Ai made me a 24-year-old millionaire",
    author: "@CARYN MARJORIE",
  },
  {
    id: 2,
    title: "Turn fan attention into real revenue",
    src: carynVideo02,
    quote: "I scaled my content income without burning out.",
    author: "@TOP CREATOR",
  },
  {
    id: 3,
    title: "Let your AI persona work while you sleep",
    src: carynVideo,
    quote: "I wake up to new conversations — and new sales.",
    author: "@GLOBAL STREAMER",
  },
];
