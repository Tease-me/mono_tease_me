import { apiClient } from "@/api/apis";
import { InfluencerLandingAssetsResponse } from "@/api/models/influencers";
import teaseMeIcon3D from "@/assets/logos/3D-IconTeaseMe-Dark.svg";
import { InfluencerServices } from "@/api/services/InfluencerService";
import { InfluencerDataModel } from "@/data/models/InfluencerDataModel";
import { InfluencerRepo } from "@/data/repositories/InfluencerRepo";
import { Paths } from "@/routes/path";
import IconButton from "@/ui/components/inputs/buttons/IconButton";
import BlockingLoader from "@/ui/components/loading/BlockingLoader";
import InfluencerWelcomeVisuals from "@/ui/screens/influencer-profile/components/InfluencerWelcomeVisuals";
import logger from "@/utils/logger";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import styles from "./VipScreen.module.css";

type VipStep = "landing" | "complete-invite-profile" | "complete-invite-avatar";

const influencerServices = InfluencerServices(apiClient);

export default function VipScreen() {
  const navigate = useNavigate();
  const { username } = useParams<{ username: string }>();
  const [searchParams] = useSearchParams();
  const influencerRepo = useMemo(() => InfluencerRepo(), []);

  const email = searchParams.get("email") ?? "";
  const invitationValid = true;
  const [step, setStep] = useState<VipStep>("landing");
  const [influencer, setInfluencer] = useState<InfluencerDataModel | null>(null);
  const [landingAssets, setLandingAssets] =
    useState<InfluencerLandingAssetsResponse | null>(null);

  useEffect(() => {
    if (!username) {
      navigate(Paths.root);
      return;
    }

    let cancelled = false;

    void influencerRepo
      .getInfluencer(username)
      .then((data) => {
        if (cancelled) return;
        setInfluencer(data);

        void influencerServices
          .getLandingAssets(data.id)
          .then((assets) => {
            if (!cancelled) setLandingAssets(assets);
          })
          .catch((error) => {
            logger.debug(error);
          });
      })
      .catch((error) => {
        logger.error(error);
        navigate(Paths.root);
      });

    return () => {
      cancelled = true;
    };
  }, [influencerRepo, navigate, username]);

  const handleLogin = () => {
    navigate(Paths.login, {
      state: { from: username ? Paths.vip(username) : Paths.root },
    });
  };

  const handleRedeemInvite = () => {
    setStep("complete-invite-profile");
  };

  const renderLanding = () => (
    <div className={styles.pageContainer}>
      <div className={styles.outerContainer}>
        <InfluencerWelcomeVisuals
          influencer={influencer!}
          landingAssets={landingAssets}
        />

        <section className={styles.contentContainer}>
          <div className={styles.greetingContainer}>
            <div className={styles.logoRow}>
              <img src={teaseMeIcon3D} alt="" />
            </div>
            <h1 className={styles.title}>
              Hi, I'm your{" "}
              <span className={styles.modelName}>{influencer?.name}</span>
            </h1>

            {invitationValid ? (
              <>
                <p className={styles.message}>
                  This invite is for{" "}
                  <span className={styles.email}>{email}</span> ONLY,
                  <br />
                  please do not share it.
                </p>
                <IconButton
                  type="square"
                  text="Redeem my invite"
                  onClick={handleRedeemInvite}
                  className={styles.redeemButton}
                />
              </>
            ) : (
              <p className={styles.message}>
                Sorry, invites are not available to the public.
              </p>
            )}
          </div>

          <div className={styles.footer}>
            <p>Already have an account?</p>
            <button className={styles.loginButton} onClick={handleLogin}>
              Login
            </button>
          </div>
        </section>
      </div>
    </div>
  );

  switch (step) {
    case "landing":
    case "complete-invite-profile":
    case "complete-invite-avatar":
    default:
      if (!influencer) return <BlockingLoader />;
      return renderLanding();
  }
}
