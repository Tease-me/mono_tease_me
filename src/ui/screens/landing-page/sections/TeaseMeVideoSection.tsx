import React, { useEffect, useRef, useState } from "react";
import { videos, type VideoItem } from "../data/videoSection";
import "./TeaseMeVideoSection.css";

interface VideoCardProps {
  video: {
    src: string;
    poster?: string;
  };
  isPlaying: boolean;
  onToggle: () => void;
}

const VideoCard: React.FC<VideoCardProps> = ({
  video,
  isPlaying,
  onToggle,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [overlayVisible, setOverlayVisible] = useState(true);
  const [overlayMode, setOverlayMode] = useState<"play" | "pause">("play");

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    let timeoutId: number | undefined;

    if (isPlaying) {
      v.play().catch(() => {});
      setOverlayMode("pause");
      setOverlayVisible(true);

      timeoutId = window.setTimeout(() => {
        setOverlayVisible(false);
      }, 600);
    } else {
      v.pause();
      setOverlayMode("play");
      setOverlayVisible(true);
    }

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [isPlaying]);

  const handleClick = () => {
    onToggle();
  };

  return (
    <article className="tm-video-card">
      <div className="tm-video-frame" onClick={handleClick}>
        <video
          ref={videoRef}
          poster={video.poster}
          className="tm-video-thumb"
          preload="metadata"
        >
          <source src={video.src} type="video/mp4" />
        </video>

        {overlayVisible && (
          <div
            className={[
              "tm-video-play-overlay",
              "show",
              overlayMode === "pause" ? "is-pause" : "is-play",
            ].join(" ")}
          >
            <div className="tm-play-button" />
          </div>
        )}
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
            Ai personas can make you high passive income
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
              <span className="tm-video-quote-mark01">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 17 12"
                  fill="none"
                >
                  <path
                    d="M14.15 11.7823L14.5932 11.2282C13.0666 9.9232 12.0693 8.90133 11.6015 8.16263C11.1336 7.44856 10.8997 6.66061 10.8997 5.79879C10.8997 4.91235 11.2814 4.41989 12.0447 4.32139L13.8176 5.9096C14.3839 5.71261 14.901 5.36789 15.3689 4.87542C15.8121 4.35833 16.0337 3.70581 16.0337 2.91786C16.0337 2.10529 15.7505 1.41584 15.1842 0.849505C14.5932 0.283168 13.793 0 12.7834 0C11.7492 0 10.912 0.393973 10.2718 1.18192C9.63163 1.96987 9.31152 3.01636 9.31152 4.32139C9.31152 5.62643 9.69318 6.88222 10.4565 8.08876C11.2198 9.29531 12.451 10.5265 14.15 11.7823Z"
                    fill="#EF064E"
                  />
                  <path
                    d="M4.83848 11.7823L5.2817 11.2282C3.75506 9.9232 2.75781 8.90133 2.28997 8.16263C1.82213 7.44856 1.5882 6.66061 1.5882 5.79879C1.5882 4.91235 1.96987 4.41989 2.73319 4.32139L4.50607 5.9096C5.0724 5.71261 5.58949 5.36789 6.05734 4.87542C6.50056 4.35833 6.72217 3.70581 6.72217 2.91786C6.72217 2.10529 6.439 1.41584 5.87266 0.849505C5.2817 0.283168 4.48145 0 3.47189 0C2.43771 0 1.60052 0.393973 0.960309 1.18192C0.320103 1.96987 -4.76837e-07 3.01636 -4.76837e-07 4.32139C-4.76837e-07 5.62643 0.381661 6.88222 1.14498 8.08876C1.90831 9.29531 3.13947 10.5265 4.83848 11.7823Z"
                    fill="#EF064E"
                  />
                </svg>
              </span>{" "}
              My girlfriend Ai made me a 24-year-old millionaire{" "}
              <span className="tm-video-quote-mark02">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 17 12"
                  fill="none"
                >
                  <path
                    d="M1.88368 11.7823L1.44046 11.2282C2.96711 9.9232 3.96436 8.90133 4.4322 8.16263C4.90004 7.44856 5.13396 6.66061 5.13396 5.79879C5.13396 4.91235 4.7523 4.41989 3.98898 4.32139L2.2161 5.9096C1.64976 5.71261 1.13267 5.36789 0.66483 4.87542C0.22161 4.35833 0 3.70581 0 2.91786C0 2.10529 0.283168 1.41584 0.849505 0.849505C1.44046 0.283168 2.24072 0 3.25028 0C4.28446 0 5.12165 0.393973 5.76186 1.18192C6.40207 1.96987 6.72217 3.01636 6.72217 4.32139C6.72217 5.62643 6.34051 6.88222 5.57718 8.08876C4.81386 9.29531 3.58269 10.5265 1.88368 11.7823Z"
                    fill="#EF064E"
                  />
                  <path
                    d="M11.1952 11.7823L10.752 11.2282C12.2786 9.9232 13.2759 8.90133 13.7437 8.16263C14.2116 7.44856 14.4455 6.66061 14.4455 5.79879C14.4455 4.91235 14.0638 4.41989 13.3005 4.32139L11.5276 5.9096C10.9613 5.71261 10.4442 5.36789 9.97635 4.87542C9.53313 4.35833 9.31152 3.70581 9.31152 2.91786C9.31152 2.10529 9.59469 1.41584 10.161 0.849505C10.752 0.283168 11.5522 0 12.5618 0C13.596 0 14.4332 0.393973 15.0734 1.18192C15.7136 1.96987 16.0337 3.01636 16.0337 4.32139C16.0337 5.62643 15.652 6.88222 14.8887 8.08876C14.1254 9.29531 12.8942 10.5265 11.1952 11.7823Z"
                    fill="#EF064E"
                  />
                </svg>
              </span>
            </p>
            <a
              href="https://www.instagram.com/cutiecaryn/"
              target="_blank"
              className="tm-video-author"
            >
              @CARYN MARJORIE
            </a>
          </div>
        )}
      </div>
    </section>
  );
};

export default TeaseMeVideoSection;
