import carynVideo from "../../../../assets/video/carynai-min.mp4";
import carynPoster from "@/assets/image/carynvidposter1.jpg"
import carynVideo02 from "../../../../assets/video/carynai2-min.mp4";

export type VideoItem = {
  id: number;
  title: string;
  src: string;
  poster:string;
  
};

export const videos: VideoItem[] = [
  {
    id: 1,
    title: "Ai personas can make you high passive income",
    src: carynVideo,
    poster: carynPoster,
   

  },
  {
    id: 2,
    title: "Turn fan attention into real revenue",
    src: carynVideo02,
    poster: carynPoster,
  

  },
  
];
