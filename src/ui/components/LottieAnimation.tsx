import React, { useRef } from "react";
import LottieLib from "react-lottie";




const Lottie = (LottieLib as any).default || LottieLib;



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
  rendererSettings = { preserveAspectRatio: "xMidYMid meet" },
  playOnClick = false,
  onComplete,
}) => {
  const lottieRef = useRef<any>(null);

  const options = {
    loop,
    autoplay: autoplay && !playOnClick, // disable autoplay if click mode
    animationData,
    rendererSettings,
  };

  const eventListeners = onComplete
    ? [{ eventName: "complete", callback: onComplete }]
    : undefined;

  const handleClick = () => {
    if (playOnClick && lottieRef.current) {
      lottieRef.current.playAnimation();
    }
  };

  return (
    <div onClick={handleClick}>
      <Lottie
        ref={lottieRef}
        options={options}
        eventListeners={eventListeners}
        isStopped={playOnClick}
      />
    </div>
  );
};

export default LottieAnimation;
