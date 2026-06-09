import React, { useEffect, useMemo, useRef } from "react";
import type { AnimationItem } from "lottie-web";

interface LottieAnimationProps {
  loop?: boolean;
  autoplay?: boolean;
  animationData: any;
  rendererSettings?: { preserveAspectRatio?: string };
  playOnClick?: boolean;
  onComplete?: () => void;
}

const LottieAnimation: React.FC<LottieAnimationProps> = ({
  loop = true,
  autoplay = true,
  animationData,
  rendererSettings,
  playOnClick = false,
  onComplete,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animationRef = useRef<AnimationItem | null>(null);

  const resolvedRendererSettings = useMemo(
    () => rendererSettings ?? { preserveAspectRatio: "xMidYMid meet" },
    [rendererSettings],
  );

  useEffect(() => {
    if (!animationData) {
      return;
    }

    let isDisposed = false;
    let currentAnimation: AnimationItem | null = null;

    const loadAnimation = async () => {
      const container = containerRef.current;

      if (!container) {
        return;
      }

      const { default: lottie } = await import("lottie-web");

      if (isDisposed || containerRef.current !== container) {
        return;
      }

      const anim = lottie.loadAnimation({
        container,
        renderer: "svg",
        loop,
        autoplay: autoplay && !playOnClick,
        animationData,
        rendererSettings: resolvedRendererSettings,
      });

      currentAnimation = anim;
      animationRef.current = anim;

      if (onComplete) {
        anim.addEventListener("complete", onComplete);
      }

      if (playOnClick) {
        anim.stop();
      }
    };

    void loadAnimation();

    return () => {
      isDisposed = true;

      if (onComplete && currentAnimation) {
        currentAnimation.removeEventListener("complete", onComplete);
      }

      currentAnimation?.destroy();
      animationRef.current = null;
    };
  }, [
    animationData,
    autoplay,
    loop,
    playOnClick,
    onComplete,
    resolvedRendererSettings,
  ]);

  const handleClick = () => {
    if (playOnClick && animationRef.current) {
      animationRef.current.play();
    }
  };

  return (
    <div onClick={handleClick}>
      <div ref={containerRef} />
    </div>
  );
};

export default LottieAnimation;
