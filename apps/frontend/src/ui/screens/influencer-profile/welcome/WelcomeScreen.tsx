import CallIcon from "@/assets/svg/Calling.svg?react";
import DropCallIcon from "@/assets/svg/HangupCall.svg?react";
import { LocalStorageKeys } from "@/constants/localStorageKeys";
import { InfluencerDataModel } from "@/data/models/InfluencerDataModel";
import useCall from "@/hooks/useCall";
import AnimatedButton from "@/ui/components/inputs/buttons/AnimatedButton";
import IconButton from "@/ui/components/inputs/buttons/IconButton";
import WelcomeCallModal from "@/ui/components/modals/welcome-call/WelcomeCallModal";
import ValidationPill from "@/ui/components/inputs/buttons/ValidationPill";
import LoadingSpinner from "@/ui/components/loading/LoadingSpinner";
import { FollowServices } from "@/api/services/FollowServices";
import { FunnelServices } from "@/api/services/FunnelServices";
import { apiClient } from "@/api/apis";
import { Paths } from "@/routes/path";
import { PublicAssetPaths } from "@/constants/publicAssetPaths";
import { invalidateFollowedInfluencersCache } from "@/hooks/messaging/useInfluencerSelection";
import { storage } from "@/utils/storage";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { Howl } from "howler";
import styles from "./WelcomeScreen.module.css";

import teaseMeIcon3D from "@/assets/logos/3D-IconTeaseMe-Dark.svg";
import { InfluencerServices } from "@/api/services/InfluencerService";
import { InfluencerLandingAssetsResponse } from "@/api/models/influencers";
import InfluencerWelcomeVisuals from "../components/InfluencerWelcomeVisuals";

const influencerServices = InfluencerServices(apiClient);
const funnelServices = FunnelServices(apiClient);

export interface WelcomeScreenProps {
  influencer: InfluencerDataModel;
  showFollowBtn: boolean;
}

export default function WelcomeScreen({ influencer, showFollowBtn }: WelcomeScreenProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const inviteCode = searchParams.get("invite");

  const [isFirstTime, setIsFirstTime] = useState(
    () => !storage.getBoolean(LocalStorageKeys.VisitedWelcome),
  );
  const [onTryClicked, setOnTryClicked] = useState(false);
  const { status, startConversation, stopConversation, setInfluencerId } = useCall();

  const audioRef = useRef(
    new Howl({ src: [PublicAssetPaths.ringtone], loop: true, html5: false }),
  );

  const [error, setError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [landingAssets, setLandingAssets] = useState<InfluencerLandingAssetsResponse | null>(null);
  const [heroReady, setHeroReady] = useState(false);

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

  // ── Funnel: fire link_clicked when landing from a Telegram invite ──
  useEffect(() => {
    if (inviteCode) {
      funnelServices.reportEvent("link_clicked", inviteCode);
    }
  }, [inviteCode]);

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
    const registerPath = inviteCode
      ? `${Paths.register(influencer.id)}?invite=${encodeURIComponent(inviteCode)}`
      : Paths.register(influencer.id);
    navigate(registerPath);
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
      invalidateFollowedInfluencersCache();
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

        <InfluencerWelcomeVisuals
          influencer={influencer}
          landingAssets={landingAssets}
          onHeroLoad={() => setHeroReady(true)}
        />

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
                    <div></div>
                  )}
                </div>
                {isFirstTime && (
                  <div className={styles.greetingRow04}>
                    Free 60 Second Trial. Try Now.
                  </div>
                )}
                {!isFirstTime && (
                  <div className={styles.greetingAfterRow04}>
                    Sign up for free to unlock exclusive access and let me whisper what you need when the lights go down.
                  </div>
                )}
              </div>

              {!showFollowBtn && isFirstTime && (
                <div className={styles.orRow}>
                  <div className={styles.orDivider}></div>
                  <div className={styles.orRowCol02}>or</div>
                  <div className={styles.orDivider}></div>
                </div>
              )}

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
