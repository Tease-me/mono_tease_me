import React, { useEffect, useRef, useState } from "react";
import { videos, type VideoItem } from "../data/videoSection";
import "./TeaseMeVideoSection.css";

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
          onClick={onToggle}
        >
          <source src={video.src} type="video/mp4" />
        </video>
      </div>
    </article>
  );
};

const TeaseMeVideoSection: React.FC = () => {
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [activeVideo, setActiveVideo] = useState<VideoItem | null>(
    videos[0] ?? null
  );

  const handleToggle = (video: VideoItem) => {
    setPlayingId((prev) => (prev === video.id ? null : video.id));
    setActiveVideo(video);
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
              onToggle={() => handleToggle(video)}
            />
          ))}
        </div>

        {activeVideo && (
          <div className="tm-video-meta">
            <p className="tm-video-quote">
              <span className="tm-video-quote-mark">❝</span>
              {activeVideo.quote}
              <span className="tm-video-quote-mark">❞</span>
            </p>
            <p className="tm-video-author">{activeVideo.author}</p>
          </div>
        )}
      </div>
    </section>
  );
};

export default TeaseMeVideoSection;
