import carynVideo from "../../../../assets/video/carynai-min.mp4";
import carynVideo02 from "../../../../assets/video/carynai2-min.mp4";

export type VideoItem = {
  id: number;
  title: string;
  src: string;
  
};

export const videos: VideoItem[] = [
  {
    id: 1,
    title: "Ai personas can make you high passive income",
    src: carynVideo,
   

  },
  {
    id: 2,
    title: "Turn fan attention into real revenue",
    src: carynVideo02,
  

  },
  {
    id: 3,
    title: "Let your AI persona work while you sleep",
    src: carynVideo,
    
  },
];
