import React, { useContext, useEffect, useRef, useState } from "react";

import clsx from "clsx";
import { useNavigate, useParams } from "react-router-dom";

import { AuthContext } from "@/context/AuthContext";
import { InfluencerDataModel } from "@/data/models/InfluencerDataModel";
import { InfluencerRepo } from "@/data/repositories/InfluencerRepo";

import DividerWithLabel from "@/ui/components/dividers/DividerWithLabel";
import AnimatedButton from "@/ui/components/inputs/buttons/AnimatedButton";
import IconButton from "@/ui/components/inputs/buttons/IconButton";
import PrimaryButton from "@/ui/components/inputs/buttons/PrimaryButton";
import BlockingLoader from "@/ui/components/loading/BlockingLoader";
import TeaseMeLogo from "@/ui/components/logos/TeaseMeLogo";
import WelcomeCallModal from "@/ui/components/modals/welcome-call/WelcomeCallModal";
import ProfileMedia from "@/ui/components/ProfileMedia";
import BackgroundGradient from "@/ui/templates/BackgroundGradient";
import CenteredLayout from "@/ui/templates/CenteredLayout";

import CallIcon from "@/assets/svg/Calling.svg?react";
import DropCallIcon from "@/assets/svg/HangupCall.svg?react";

import { LocalStorageKeys } from "@/constants/localStorageKeys";
import useCall from "@/hooks/useCall";
import logger from "@/utils/logger";
import { storage } from "@/utils/storage";

import InfluencerProfile from "../influencer-profile/profile/InfluencerProfile";
import styles from "./WelcomeScreen.module.css"; // reaproveitando o CSS que você já tem

interface InfluencerWelcomeProps {}

const InfluencerWelcome: React.FC<InfluencerWelcomeProps> = () => {
  const { username } = useParams<{ username: string }>();
  const { isSignedIn } = useContext(AuthContext);
  const navigate = useNavigate();

  const [influencer, setInfluencer] = useState<InfluencerDataModel>();
  const [isFirstTime, setIsFirstTime] = useState(true);
  const [onTryClicked, setOnTryClicked] = useState(false);

  const { status, startConversation, stopConversation, setInfluencerId } =
    useCall();

  const audioRef = useRef(new Audio("/audio/ringtone.wav"));

  const influencerRepo = InfluencerRepo();

  // Buscar influencer por username OU aleatório
  useEffect(() => {
    (async () => {
      try {
        if (username) {
          const localInfluencer = await influencerRepo.getInfluencer(username);
          setInfluencer(localInfluencer);
        } else {
          const localInfluencers = await influencerRepo.getInfluencers();
          if (localInfluencers.length > 0) {
            const randomIndex = Math.floor(
              Math.random() * localInfluencers.length
            );
            const randomInfluencer = localInfluencers[randomIndex];
            setInfluencer(randomInfluencer);
          }
        }
      } catch (err) {
        logger.error(err);
        const localInfluencers = await influencerRepo.getInfluencers();
        if (localInfluencers.length > 0) {
          const randomIndex = Math.floor(
            Math.random() * localInfluencers.length
          );
          const randomInfluencer = localInfluencers[randomIndex];
          setInfluencer(randomInfluencer);
        }
      }
    })();
  }, [username]);

  // Atualiza localStorage e estado conforme status da call
  useEffect(() => {
    if (status === "connected") {
      storage.setBoolean(LocalStorageKeys.VisitedWelcome, true);
    } else if (status === "disconnected") {
      setIsFirstTime(false);
      setOnTryClicked(false);
    }
  }, [status]);

  useEffect(() => {
    audioRef.current.currentTime = 0;
    audioRef.current.play();
    setOnTryClicked(true);

    // para o toque depois de 60s se ninguém atender
    setTimeout(() => {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }, 60000);
  }, []);

  // Passar influencerId pro hook de call
  useEffect(() => {
    if (influencer?.id) {
      setInfluencerId(influencer.id);
    }
  }, [influencer, setInfluencerId]);

  const handleSignInClick = () => {
    navigate("/login");
  };

  const handleTryClick = () => {
    audioRef.current.currentTime = 0;
    audioRef.current.play();
    setOnTryClicked(true);

    // para o toque depois de 60s se ninguém atender
    setTimeout(() => {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }, 60000);
  };

  const handlePickUpCall = () => {
    audioRef.current.pause();
    startConversation();
  };

  const handleHangUpCall = () => {
    audioRef.current.pause();
    stopConversation();
    setIsFirstTime(false);
    setOnTryClicked(false);
  };

  const incomingCall = status === "idle" && onTryClicked;

  // Enquanto não carregou influencer, mostra loader
  if (!influencer) return <BlockingLoader />;

  // Se usuário já está logado → mostra perfil diretamente
  if (isSignedIn) {
    return <InfluencerProfile influencer={influencer} />;
  }

  // Se NÃO está logado → tela de Welcome + call
  return (
    <BackgroundGradient>
      <CenteredLayout>
        <div className={styles["welcome-root"]}>
          <ProfileMedia
            className={clsx(
              styles["profile-container"],
              onTryClicked && styles["zoomed"]
            )}
            imageSrc={influencer.img}
            videoSrc={influencer.videoUrl}
            showHearts={!onTryClicked}
            active
            size="xlarge"
            mediaType="video"
          />

          {!onTryClicked && (
            <h2 className={styles["join-text"]}>Join {influencer.name} on</h2>
          )}

          {incomingCall ? (
            <>
              <div className={styles["incoming-call-text"]}>Incoming Call</div>
              <div className={styles["influencer-name"]}>{influencer.name}</div>
              <div className={styles["call-buttons"]}>
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
            <div className={styles["welcome-screen-container"]}>
              <TeaseMeLogo size="xlarge" variant="full-dark" />

              <p className={styles["signup-text"]}>
                Don&apos;t have an account?{" "}
                <span
                  className={styles["signup-link"]}
                  onClick={() => navigate("/register")}
                  style={{ cursor: "pointer", color: "#ff4d6d" }}
                >
                  Sign up
                </span>
              </p>

              <DividerWithLabel text="or" />

              <div className={styles["buttons-container"]}>
                {!isFirstTime ? (
                  <PrimaryButton
                    text="Sign in with email"
                    className={styles["sign-in-button"]}
                    onClick={handleSignInClick}
                  />
                ) : (
                  <PrimaryButton
                    text="Talk to me Now"
                    onClick={handleTryClick}
                  />
                )}

                <p className={styles["signup-text"]}>
                  Already have an account?{" "}
                  <span
                    className={styles["signup-link"]}
                    onClick={() => navigate("/login")}
                    style={{ cursor: "pointer", color: "#ff4d6d" }}
                  >
                    Login
                  </span>
                </p>
              </div>
            </div>
          )}

          <WelcomeCallModal
            isOpen={status === "connected"}
            onClose={() => {
              setOnTryClicked(false);
            }}
            influencer={influencer}
            status={status}
            stopConversation={stopConversation}
          />
        </div>
      </CenteredLayout>
    </BackgroundGradient>
  );
};

export default InfluencerWelcome;
