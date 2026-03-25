import CallIcon from "@/assets/svg/Calling.svg?react";
import DropCallIcon from "@/assets/svg/HangupCall.svg?react";
import { LocalStorageKeys } from "@/constants/localStorageKeys";
import { InfluencerDataModel } from "@/data/models/InfluencerDataModel";
import useCall from "@/hooks/useCall";
import AnimatedButton from "@/ui/components/inputs/buttons/AnimatedButton";
import IconButton from "@/ui/components/inputs/buttons/IconButton";
import WelcomeCallModal from "@/ui/components/modals/welcome-call/WelcomeCallModal";
import ValidationPill from "@/ui/components/inputs/buttons/ValidationPill";
import LottieAnimation from "@/ui/components/LottieAnimation";
import LoadingSpinner from "@/ui/components/loading/LoadingSpinner";
import { FollowServices } from "@/api/services/FollowServices";
import { apiClient } from "@/api/apis";
import { Paths } from "@/routes/path";
import { storage } from "@/utils/storage";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Howl } from "howler";
import styles from "./WelcomeScreen.module.css";

import lpBgMinWebm from "@/assets/influencerWelcome/video/lpbgmin.webm";
import lpBgMinMp4 from "@/assets/influencerWelcome/video/lpbgmin.mp4";
import lpBgMinPoster from "@/assets/influencerWelcome/video/lpbgminPoster.jpg";
import lottieAudioWave from "@/assets/influencerWelcome/lottie/lottieAudiowave.json";
import teaseMeIcon3D from "@/assets/logos/3D-IconTeaseMe-Dark.svg";
import { InfluencerServices } from "@/api/services/InfluencerService";
import { InfluencerLandingAssetsResponse } from "@/api/models/influencers";

const influencerServices = InfluencerServices(apiClient);

export interface WelcomeScreenProps {
  influencer: InfluencerDataModel;
  showFollowBtn: boolean;
}

export default function WelcomeScreen({ influencer, showFollowBtn }: WelcomeScreenProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const [onTryClicked, setOnTryClicked] = useState(false);
  const { status, startConversation, stopConversation, setInfluencerId } = useCall();

  const audioRef = useRef(
    new Howl({ src: ["/audio/ringtone.mp3"], loop: true, html5: false }),
  );

  const [error, setError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [landingAssets, setLandingAssets] = useState<InfluencerLandingAssetsResponse | null>(null);
  const [heroReady, setHeroReady] = useState(false);


  useEffect(() => {
    return () => {
      audioRef.current.stop();
      audioRef.current.unload();
    };
  }, []);

  useEffect(() => {
    setInfluencerId(influencer?.id);
    setHeroReady(false);
  }, [influencer]);

  useEffect(() => {
    if (!influencer?.id) return;
    let cancelled = false;
    void influencerServices.getLandingAssets(influencer.id).then((data) => {
      if (!cancelled) {
        setLandingAssets(data);
        if (!data.hero_png_url) setHeroReady(true);
      }
    }).catch(() => {
      if (!cancelled) setHeroReady(true);
    });
    return () => { cancelled = true; };
  }, [influencer?.id]);

  const handleSignInClick = () => {
    navigate(Paths.login, { state: { from: location.pathname } });
  };

  const handleSignUpClick = () => {
    if (!influencer?.id) return;
    navigate(Paths.register(influencer.id));
  };

  const handlePickUpCall = () => {
    audioRef.current.stop();
    startConversation();
  };

  const handleHangUpCall = () => {
    audioRef.current.stop();
    stopConversation();
    setOnTryClicked(false);
  };

  const handleFollowMe = async () => {
    const followServices = FollowServices(apiClient);
    try {
      setWaiting(true);
      await followServices.follow(influencer.id);
      setError(null);
      storage.set(LocalStorageKeys.SelectedId, influencer.id);
      navigate(Paths.home);
      setWaiting(false);
    } catch (err: any) {
      setWaiting(false);
      setError(err.message);
    }
  };

  const incomingCall = status === "idle" && onTryClicked;

  if (!heroReady) {
    return (
      <div className={styles.pageContainer}>
        <div className={styles.loadingState}>
          <LoadingSpinner size="medium" />
        </div>
        {landingAssets?.hero_png_url && (
          <img
            src={landingAssets.hero_png_url}
            srcSet={landingAssets.hero_png_2x_url ? `${landingAssets.hero_png_url} 1x, ${landingAssets.hero_png_2x_url} 2x` : undefined}
            onLoad={() => setHeroReady(true)}
            className={styles.hiddenPreload}
            alt=""
          />
        )}
      </div>
    );
  }

  return (
    <div className={styles.pageContainer}>
      <div className={styles.outerContainer}>

        {/* Left panel — profile visuals */}
        <div className={styles.profileContainer}>
          <div className={styles.bgLpVideo}>
            <video autoPlay muted playsInline loop poster={lpBgMinPoster}>
              <source src={lpBgMinWebm} type="video/webm" />
              <source src={lpBgMinMp4} type="video/mp4" />
            </video>
          </div>

          <div className={styles.tileHolder}>
            {landingAssets?.signature_png_url && (
              <div className={styles.imageSignature}>
                <img
                  src={landingAssets.signature_png_url}
                  alt=""
                  srcSet={landingAssets.signature_png_2x_url ? `${landingAssets.signature_png_url} 1x, ${landingAssets.signature_png_2x_url} 2x` : undefined}
                />
              </div>
            )}

            {landingAssets?.background_image_1_url && (
              <div className={styles.image01}>
                <img
                  src={landingAssets.background_image_1_url}
                  alt=""
                  srcSet={landingAssets.background_image_1_2x_url ? `${landingAssets.background_image_1_url} 1x, ${landingAssets.background_image_1_2x_url} 2x` : undefined}
                />
              </div>
            )}

            {landingAssets?.background_image_2_url && (
              <div className={styles.image02}>
                <img
                  src={landingAssets.background_image_2_url}
                  alt=""
                  srcSet={landingAssets.background_image_2_2x_url ? `${landingAssets.background_image_2_url} 1x, ${landingAssets.background_image_2_2x_url} 2x` : undefined}
                />
              </div>
            )}

            {landingAssets?.background_video_1_mp4_url && (
              <div className={styles.lpVideo01}>
                <video autoPlay muted playsInline loop poster={landingAssets.background_video_1_poster_jpg_url ?? undefined}>
                  {landingAssets.background_video_1_webm_url && (
                    <source src={landingAssets.background_video_1_webm_url} type="video/webm" />
                  )}
                  <source src={landingAssets.background_video_1_mp4_url} type="video/mp4" />
                </video>
              </div>
            )}

            {landingAssets?.background_video_2_mp4_url && (
              <div className={styles.lpVideo02}>
                <video autoPlay muted playsInline loop poster={landingAssets.background_video_2_poster_jpg_url ?? undefined}>
                  {landingAssets.background_video_2_webm_url && (
                    <source src={landingAssets.background_video_2_webm_url} type="video/webm" />
                  )}
                  <source src={landingAssets.background_video_2_mp4_url} type="video/mp4" />
                </video>
              </div>
            )}

            {landingAssets?.background_image_3_url && (
              <div className={styles.image03}>
                <img
                  src={landingAssets.background_image_3_url}
                  alt=""
                  srcSet={landingAssets.background_image_3_2x_url ? `${landingAssets.background_image_3_url} 1x, ${landingAssets.background_image_3_2x_url} 2x` : undefined}
                />
              </div>
            )}

            <div className={styles.audioLottie}>
              <LottieAnimation loop autoplay animationData={lottieAudioWave} />
            </div>
          </div>

          {landingAssets?.hero_png_url && (
            <div className={styles.lpBodyShot}>
              <img
                src={landingAssets.hero_png_url}
                alt={influencer?.name}
                srcSet={landingAssets.hero_png_2x_url ? `${landingAssets.hero_png_url} 1x, ${landingAssets.hero_png_2x_url} 2x` : undefined}
                onLoad={() => setHeroReady(true)}
              />
            </div>
          )}
        </div>

        {/* Right panel — content */}
        <div className={styles.contentContainer}>
          {incomingCall ? (
            <>
              <div className={styles.incomingCallText}>Incoming Call</div>
              <div className={styles.influencerCallName}>{influencer.name}</div>
              <div className={styles.callButtons}>
                <IconButton
                  leftIcon={<DropCallIcon color="red" />}
                  onClick={handleHangUpCall}
                  text="Reject"
                  color="black"
                />
                <AnimatedButton
                  leftIcon={<CallIcon />}
                  onClick={handlePickUpCall}
                  text="Answer"
                  color="green"
                />
              </div>
            </>
          ) : (
            <>
              <div className={styles.greetingContainer}>
                <div className={styles.greetingRow01}>
                  <img src={teaseMeIcon3D} alt="" />
                </div>
                <div className={styles.greetingRow02}>
                  Hi, I'm your <div className={styles.modelName}>{influencer?.name}</div>
                </div>
                <div className={styles.greetingRow03}>
                  {showFollowBtn && (
                    <IconButton
                      color="pink-glass"
                      text={waiting ? "Connecting.." : "Follow me now"}
                      onClick={handleFollowMe}
                      disabled={waiting}
                      className={styles.fullBtn}
                    />
                  )}
                </div>
                {!showFollowBtn && <div className={styles.greetingRow04}>Sign up for free to unlock exclusive access and let me whisper what you need when the lights go down.</div>}
              </div>

              {!showFollowBtn && (
                <>
                  <div className={styles.ctaContainer}>
                    <div className={styles.ctaRow01}>
                      <p>No payment or credit card required</p>
                    </div>
                    <div className={styles.ctaRow02}>
                      <IconButton
                        type="square"
                        text="Sign up for FREE"
                        onClick={handleSignUpClick}
                        className={styles.fullBtn}
                      />
                    </div>
                    <div className={styles.ctaRow03}>
                      <p>Already have an account?</p>
                      <button className={styles.loginButton} onClick={handleSignInClick}>
                        Log In
                      </button>
                    </div>
                  </div>
                </>
              )}

              {error !== null && (
                <ValidationPill className={styles.errorArea} variant="error">
                  Error: {error}
                </ValidationPill>
              )}

              <div className={styles.bottomGlow}>
                <div className={styles.circle01} />
                <div className={styles.circle02} />
                <div className={styles.circle03} />
                <div className={styles.circle04} />
              </div>
            </>
          )}
        </div>
      </div>

      <WelcomeCallModal
        isOpen={onTryClicked || status === "connected"}
        onClose={() => setOnTryClicked(false)}
        influencer={influencer}
        status={status}
        stopConversation={stopConversation}
      />
    </div>
  );
}
