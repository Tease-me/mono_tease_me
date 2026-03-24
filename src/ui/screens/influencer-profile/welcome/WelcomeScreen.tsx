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
import { FollowServices } from "@/api/services/FollowServices";
import { apiClient } from "@/api/apis";
import { Paths } from "@/routes/path";
import { storage } from "@/utils/storage";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Howl } from "howler";
import styles from "./WelcomeScreen.module.css";

import lpBodyShot from "@/assets/adult/juliana/landingpage/lpbodyshot.png";
import lpBodyShot2x from "@/assets/adult/juliana/landingpage/lpbodyshot@2x.png";
import signatureImg from "@/assets/adult/juliana/landingpage/signature.png";
import signatureImg2x from "@/assets/adult/juliana/landingpage/signature@2x.png";
import image01 from "@/assets/adult/juliana/landingpage/image01.png";
import image01x2 from "@/assets/adult/juliana/landingpage/image01@2x.png";
import image02 from "@/assets/adult/juliana/landingpage/image02.png";
import image02x2 from "@/assets/adult/juliana/landingpage/image02@2x.png";
import image03 from "@/assets/adult/juliana/landingpage/image03.png";
import image03x2 from "@/assets/adult/juliana/landingpage/image03@2x.png";
import lpBgMinWebm from "@/assets/adult/juliana/video/lpbgmin.webm";
import lpBgMinMp4 from "@/assets/adult/juliana/video/lpbgmin.mp4";
import lpBgMinPoster from "@/assets/adult/juliana/video/lpbgminPoster.jpg";
import lpVideo01Webm from "@/assets/adult/juliana/video/lpvideo01min.webm";
import lpVideo01Mp4 from "@/assets/adult/juliana/video/lpvideo01min.mp4";
import lpVideo01Poster from "@/assets/adult/juliana/video/lpvideo01minPoster.jpg";
import lpVideo02Webm from "@/assets/adult/juliana/video/lpvideo02min.webm";
import lpVideo02Mp4 from "@/assets/adult/juliana/video/lpvideo02min.mp4";
import lpVideo02Poster from "@/assets/adult/juliana/video/lpvideo02minPoster.jpg";
import lottieAudioWave from "@/assets/adult/juliana/lottie/lottieAudiowave.json";
import teaseMeIcon3D from "@/assets/logos/3D-IconTeaseMe-Dark.svg";

export interface WelcomeScreenProps {
  influencer: InfluencerDataModel;
  showFollowBtn: boolean;
}

export default function WelcomeScreen({ influencer, showFollowBtn }: WelcomeScreenProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const [isFirstTime, setIsFirstTime] = useState(
    () => !storage.getBoolean(LocalStorageKeys.VisitedWelcome),
  );
  const [onTryClicked, setOnTryClicked] = useState(false);
  const { status, startConversation, stopConversation, setInfluencerId } = useCall();

  const audioRef = useRef(
    new Howl({ src: ["/audio/ringtone.mp3"], loop: true, html5: false }),
  );

  const [error, setError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);

  const syncIsFirstTimeFromStorage = () => {
    setIsFirstTime(!storage.getBoolean(LocalStorageKeys.VisitedWelcome));
  };

  useEffect(() => {
    if (status === "connected") {
      storage.setBoolean(LocalStorageKeys.VisitedWelcome, true);
      syncIsFirstTimeFromStorage();
    } else if (status === "disconnected") {
      syncIsFirstTimeFromStorage();
    }
  }, [status]);

  useEffect(() => {
    return () => {
      audioRef.current.stop();
      audioRef.current.unload();
    };
  }, []);

  useEffect(() => {
    setInfluencerId(influencer?.id);
  }, [influencer]);

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
    storage.setBoolean(LocalStorageKeys.VisitedWelcome, true);
    syncIsFirstTimeFromStorage();
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
            <div className={styles.imageSignature}>
              <img
                src={signatureImg}
                alt=""
                srcSet={`${signatureImg} 1x, ${signatureImg2x} 2x`}
              />
            </div>

            <div className={styles.image01}>
              <img src={image01} alt="" srcSet={`${image01} 1x, ${image01x2} 2x`} />
            </div>

            <div className={styles.image02}>
              <img src={image02} alt="" srcSet={`${image02} 1x, ${image02x2} 2x`} />
            </div>

            <div className={styles.lpVideo01}>
              <video autoPlay muted playsInline loop poster={lpVideo01Poster}>
                <source src={lpVideo01Webm} type="video/webm" />
                <source src={lpVideo01Mp4} type="video/mp4" />
              </video>
            </div>

            <div className={styles.lpVideo02}>
              <video autoPlay muted playsInline loop poster={lpVideo02Poster}>
                <source src={lpVideo02Webm} type="video/webm" />
                <source src={lpVideo02Mp4} type="video/mp4" />
              </video>
            </div>

            <div className={styles.image03}>
              <img src={image03} alt="" srcSet={`${image03} 1x, ${image03x2} 2x`} />
            </div>

            <div className={styles.audioLottie}>
              <LottieAnimation loop autoplay animationData={lottieAudioWave} />
            </div>
          </div>

          <div className={styles.lpBodyShot}>
            <img
              src={lpBodyShot}
              alt={influencer?.name}
              srcSet={`${lpBodyShot} 1x, ${lpBodyShot2x} 2x`}
            />
          </div>
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
                  {showFollowBtn ? (
                    <IconButton
                      color="pink-glass"
                      text={waiting ? "Connecting.." : "Follow me now"}
                      onClick={handleFollowMe}
                      disabled={waiting}
                      className={styles.fullBtn}
                    />
                  ) : isFirstTime ? (
                    <IconButton
                      color="pink-glass"
                      text="Talk dirty to me"
                      leftIcon={<CallIcon />}
                      onClick={() => {
                        startConversation();
                        setOnTryClicked(true);
                      }}
                      className={styles.autoBtn}
                    />
                  ) : (
                    <IconButton
                      color="pink-glass"
                      text="Sign in with email"
                      onClick={handleSignInClick}
                      className={styles.autoBtn}
                    />
                  )}
                </div>
                <div className={styles.greetingRow04}>Free 30 Second Trial. Try Now.</div>
              </div>

              {!showFollowBtn && (
                <>
                  <div className={styles.orRow}>
                    <div className={styles.orDivider} />
                    <div className={styles.orRowCol02}>or</div>
                    <div className={styles.orDivider} />
                  </div>

                  <div className={styles.ctaContainer}>
                    <div className={styles.ctaRow01}>
                      <p>No payment or credit card required</p>
                    </div>
                    <div className={styles.ctaRow02}>
                      <IconButton
                        type="square"
                        color="pink-glass"
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
