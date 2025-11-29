import React, { useEffect, useRef, useState } from "react";
import "./TeaseMeVideoSection.css";

import avatarVideo from "@/assets/video/avatar_video.mp4";

type VideoItem = {
  id: number;
  title: string;
  src: string;
  quote: string;
  author: string;
};

const videos: VideoItem[] = [
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

type VideoCardProps = {
  video: VideoItem;
  isPlaying: boolean;
  onToggle: () => void;
};

const VideoCard: React.FC<VideoCardProps> = ({
  video,
  isPlaying,
  onToggle,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    if (isPlaying) {
      v.play().catch(() => {});
    } else {
      v.pause();
      v.currentTime = 0;
    }
  }, [isPlaying]);

  return (
    <article className="tm-video-card">
      <div className="tm-video-frame">
        <video
          ref={videoRef}
          className="tm-video-thumb"
          muted
          playsInline
          preload="metadata"
          onClick={onToggle} // 👈 só clicar no vídeo
        >
          <source src={video.src} type="video/mp4" />
        </video>
      </div>

      <div className="tm-video-meta">
        <p className="tm-video-quote">
          <span className="tm-video-quote-mark">❝</span>
          {video.quote}
          <span className="tm-video-quote-mark">❞</span>
        </p>
        <p className="tm-video-author">{video.author}</p>
      </div>
    </article>
  );
};

const TeaseMeVideoSection: React.FC = () => {
  const [playingId, setPlayingId] = useState<number | null>(null);

  const handleToggle = (id: number) => {
    setPlayingId((prev) => (prev === id ? null : id));
  };

  return (
    <section className="tm-video-section">
      <div className="tm-video-container">
        <div className="tm-video-header">
          <h2 className="tm-video-title">
            AI personas can make you <br />
            high passive income
          </h2>
          <button className="tm-video-cta">Watch videos</button>
        </div>

        <div className="tm-video-scroll">
          {videos.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              isPlaying={playingId === video.id}
              onToggle={() => handleToggle(video.id)}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default TeaseMeVideoSection;
