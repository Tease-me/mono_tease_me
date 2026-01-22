import React, { useEffect, useMemo, useRef } from "react";
import lottie from "lottie-web";



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
  const animationRef = useRef<ReturnType<typeof lottie.loadAnimation> | null>(null);

  const resolvedRendererSettings = useMemo(
    () => rendererSettings ?? { preserveAspectRatio: "xMidYMid meet" },
    [rendererSettings],
  );

  useEffect(() => {
    if (!containerRef.current || !animationData) {
      return;
    }

    const anim = lottie.loadAnimation({
      container: containerRef.current,
      renderer: "svg",
      loop,
      autoplay: autoplay && !playOnClick,
      animationData,
      rendererSettings: resolvedRendererSettings,
    });
    animationRef.current = anim;

    if (onComplete) {
      anim.addEventListener("complete", onComplete);
    }

    if (playOnClick) {
      anim.stop();
    }

    return () => {
      if (onComplete) {
        anim.removeEventListener("complete", onComplete);
      }
      anim.destroy();
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
