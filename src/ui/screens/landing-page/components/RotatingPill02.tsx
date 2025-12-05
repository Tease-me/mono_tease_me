import React, { useEffect, useState } from "react";
import "./RotatingPill02.css"; // ou reutilizar TeaseMeLanding.css se já tiver as classes

type RotatingPillProps = {
  phrases: string[];
  /** time each phrase stays still before animating (ms) */
  displayDuration?: number;
  /** animation duration (ms) – deve bater com o CSS */
  animationDuration?: number;
  className?: string;
};

const RotatingPill: React.FC<RotatingPillProps> = ({
  phrases,
  displayDuration = 1800,
  animationDuration = 350,
  className = "",
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const nextIndex = (currentIndex + 1) % phrases.length;

  // wait some time, then start animation
  useEffect(() => {
    const id = setTimeout(() => setIsAnimating(true), displayDuration);
    return () => clearTimeout(id);
  }, [currentIndex, displayDuration]);

  // after animation, switch phrase
  useEffect(() => {
    if (!isAnimating) return;
    const id = setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % phrases.length);
      setIsAnimating(false);
    }, animationDuration);
    return () => clearTimeout(id);
  }, [isAnimating, animationDuration]);

  return (
    <span className={`tm-tagline-pill02 ${className}`}>
      <span className="tm-pill-layer">
        <span
          className={`tm-pill-text tm-pill-current ${
            isAnimating ? "tm-pill-out" : ""
          }`}
        >
          {phrases[currentIndex]}
        </span>

        {isAnimating && (
          <span className="tm-pill-text tm-pill-next tm-pill-in">
            {phrases[nextIndex]}
          </span>
        )}
      </span>
    </span>
  );
};

export default RotatingPill;
