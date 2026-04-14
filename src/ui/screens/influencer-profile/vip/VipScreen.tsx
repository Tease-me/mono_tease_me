import { apiClient } from "@/api/apis";
import { InfluencerLandingAssetsResponse } from "@/api/models/influencers";
import { FollowServices } from "@/api/services/FollowServices";
import { FunnelServices } from "@/api/services/FunnelServices";
import { InfluencerServices } from "@/api/services/InfluencerService";
import { LocalStorageKeys } from "@/constants/localStorageKeys";
import { AuthContext } from "@/context/AuthContext";
import { InfluencerDataModel } from "@/data/models/InfluencerDataModel";
import { InfluencerRepo } from "@/data/repositories/InfluencerRepo";
import { Paths } from "@/routes/path";
import AvatarPicker from "@/ui/components/avatar-picker/AvatarPicker";
import BlockingLoader from "@/ui/components/loading/BlockingLoader";
import DisclaimerModal from "@/ui/components/modals/DisclaimerModal";
import InfluencerWelcomeVisuals from "@/ui/screens/influencer-profile/components/InfluencerWelcomeVisuals";
import logger from "@/utils/logger";
import { storage } from "@/utils/storage";
import { validationRules } from "@/utils/validationRules";
import { required, validateFields } from "@/utils/validations";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import VipAvatarStep from "./steps/VipAvatarStep";
import VipLandingStep from "./steps/VipLandingStep";
import VipProfileStep, {
  InviteProfileErrors,
  InviteProfileValues,
} from "./steps/VipProfileStep";
import styles from "./VipScreen.module.css";

type VipStep = "landing" | "complete-invite-profile" | "complete-invite-avatar";
type InviteAvatarValues = {
  gender: "male" | "female";
  avatarUrl?: string;
};
type ViewerState = "loading" | "guest" | "following" | "not-following";
type AutoFollowState = "idle" | "pending" | "complete" | "failed";
type InviteStatus = "valid" | "expired" | "invalid";
type InviteValidationInput = {
  inviteCode: string | null;
  email: string;
};
type InviteValidationResult = {
  inviteCode: string | null;
  email: string;
  status: InviteStatus;
};

const influencerServices = InfluencerServices(apiClient);
const followServices = FollowServices(apiClient);
const funnelServices = FunnelServices(apiClient);

const validateInviteForNow = ({
  inviteCode,
  email,
}: InviteValidationInput): InviteValidationResult => {
  const hasEmail = email.trim().length > 0;
  const testStatus: InviteStatus | null =
    inviteCode === "expired"
      ? "expired"
      : inviteCode === "invalid"
        ? "invalid"
        : null;

  return {
    inviteCode,
    email,
    status: testStatus ?? (hasEmail ? "valid" : "invalid"),
  };
};

export default function VipScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { username } = useParams<{ username: string }>();
  const [searchParams] = useSearchParams();
  const influencerRepo = useMemo(() => InfluencerRepo(), []);
  const { isSignedIn, loadingAuth } = useContext(AuthContext);

  const inviteCode = searchParams.get("invite");
  const email = searchParams.get("email") ?? "";
  const inviteValidation = useMemo(
    () => validateInviteForNow({ inviteCode, email }),
    [email, inviteCode],
  );
  const invitationValid = inviteValidation.status === "valid";
  const invitationExpired = inviteValidation.status === "expired";
  const [step, setStep] = useState<VipStep>("landing");
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [profileValues, setProfileValues] = useState<InviteProfileValues>({
    userName: "",
    fullName: "",
    dateOfBirth: "",
    email,
    password: "",
    confirmPassword: "",
  });
  const [avatarValues, setAvatarValues] = useState<InviteAvatarValues>(() => {
    const folder = Math.random() < 0.5 ? "human" : "animal";
    const index = Math.floor(Math.random() * 12) + 1;

    return {
      gender: "male",
      avatarUrl: `/avatarImages/${folder}/avatar${index}.jpg`,
    };
  });
  const [profileErrors, setProfileErrors] = useState<InviteProfileErrors>({});
  const [influencer, setInfluencer] = useState<InfluencerDataModel | null>(null);
  const [landingAssets, setLandingAssets] =
    useState<InfluencerLandingAssetsResponse | null>(null);
  const [viewerState, setViewerState] = useState<ViewerState>("loading");
  const [autoFollowState, setAutoFollowState] =
    useState<AutoFollowState>("idle");
  const [autoFollowRetryKey, setAutoFollowRetryKey] = useState(0);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const autoFollowStartedRef = useRef<string | null>(null);
  const [heroReady, setHeroReady] = useState(false);

  useEffect(() => {
    if (
      inviteCode &&
      (viewerState === "guest" || viewerState === "not-following")
    ) {
      void funnelServices.reportEvent("link_clicked", inviteCode);
    }
  }, [inviteCode, viewerState]);

  useEffect(() => {
    if (!username) {
      navigate(Paths.root);
      return;
    }

    let cancelled = false;
    setInfluencer(null);
    setLandingAssets(null);
    setHeroReady(false);
    setViewerState("loading");
    setAutoFollowState("idle");
    autoFollowStartedRef.current = null;

    void influencerRepo
      .getInfluencer(username)
      .then((data) => {
        if (cancelled) return;
        setInfluencer(data);

        void influencerServices
          .getLandingAssets(data.id)
          .then((assets) => {
            if (!cancelled) {
              setLandingAssets(assets);
              if (!assets.hero_png_url) setHeroReady(true);
            }
          })
          .catch((error) => {
            logger.debug(error);
            if (!cancelled) setHeroReady(true);
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

  useEffect(() => {
    if (loadingAuth || !influencer?.id) return;

    if (!isSignedIn) {
      setViewerState("guest");
      return;
    }

    let cancelled = false;
    setViewerState("loading");

    void followServices
      .list()
      .then(({ items }) => {
        if (cancelled) return;

        const following = items.some(
          (item) =>
            item.influencer_id === influencer.id && item.following !== false,
        );

        setViewerState(following ? "following" : "not-following");
      })
      .catch((error) => {
        logger.debug(error);
        if (!cancelled) setViewerState("not-following");
      });

    return () => {
      cancelled = true;
    };
  }, [influencer?.id, isSignedIn, loadingAuth]);

  useEffect(() => {
    if (viewerState !== "following" || !influencer?.id) return;

    storage.set(LocalStorageKeys.SelectedId, influencer.id.toString());
    navigate(Paths.home);
  }, [influencer?.id, navigate, viewerState]);

  useEffect(() => {
    if (viewerState !== "guest" && viewerState !== "not-following") return;

    if (!storage.getBoolean(LocalStorageKeys.DisclaimerSeen)) {
      setShowDisclaimer(true);
    }
  }, [viewerState, username]);

  useEffect(() => {
    if (
      viewerState !== "not-following" ||
      !influencer?.id ||
      !invitationValid
    ) {
      setAutoFollowState("idle");
      autoFollowStartedRef.current = null;
      return;
    }

    const autoFollowKey = `${influencer.id}:${autoFollowRetryKey}`;
    if (autoFollowStartedRef.current === autoFollowKey) return;
    autoFollowStartedRef.current = autoFollowKey;
    setAutoFollowState("pending");

    void followServices
      .follow(influencer.id)
      .then(() => {
        storage.set(LocalStorageKeys.SelectedId, influencer.id.toString());
        setAutoFollowState("complete");
      })
      .catch((error) => {
        logger.debug(error);
        setAutoFollowState("failed");
      });
  }, [autoFollowRetryKey, influencer?.id, invitationValid, viewerState]);

  useEffect(() => {
    setProfileValues((prev) => ({ ...prev, email }));
  }, [email]);

  const cleanErrors = <T extends Record<string, string | undefined>>(
    errors: T,
  ) =>
    Object.fromEntries(
      Object.entries(errors).filter(
        ([, value]) => value !== undefined && value !== "",
      ),
    ) as Partial<T>;

  const isAdult = (isoDate: string, minimumAge = 18) => {
    if (!isoDate) return false;
    const dob = new Date(isoDate);
    if (Number.isNaN(dob.getTime())) return false;
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age -= 1;
    }
    return age >= minimumAge;
  };

  const validateInviteProfile = () => {
    const fieldErrors = validateFields(
      {
        userName: profileValues.userName,
        fullName: profileValues.fullName,
        dateOfBirth: profileValues.dateOfBirth,
        email: profileValues.email,
        password: profileValues.password,
        confirmPassword: profileValues.confirmPassword,
      },
      {
        userName: validationRules.username,
        fullName: required("Full name"),
        dateOfBirth: required("Date of birth"),
        email: validationRules.email,
        password: validationRules.password,
        confirmPassword: validationRules.password,
      },
    );

    const nextErrors: InviteProfileErrors = { ...fieldErrors };

    if (!nextErrors.dateOfBirth && !isAdult(profileValues.dateOfBirth)) {
      nextErrors.dateOfBirth = "You must be at least 18 years old";
    }

    if (
      profileValues.password &&
      profileValues.confirmPassword &&
      profileValues.password !== profileValues.confirmPassword
    ) {
      nextErrors.confirmPassword = "Passwords do not match";
    }

    return cleanErrors(nextErrors);
  };

  const validateInviteField = (field: keyof InviteProfileValues) => {
    let error: string | undefined;
    const value = profileValues[field];

    if (field === "userName") error = validationRules.nickName(value);
    if (field === "fullName") error = required("Full name")(value);
    if (field === "email") error = validationRules.email(value);
    if (field === "password") error = validationRules.password(value);
    if (field === "confirmPassword") {
      error = validationRules.password(value);
      if (!error && profileValues.password && value && profileValues.password !== value) {
        error = "Passwords do not match";
      }
    }
    if (field === "dateOfBirth") {
      error = required("Date of birth")(value);
      if (!error && !isAdult(value)) {
        error = "You must be at least 18 years old";
      }
    }

    setProfileErrors((prev) => ({ ...prev, [field]: error }));
  };

  const handleLogin = () => {
    navigate(Paths.login, {
      state: { from: `${location.pathname}${location.search}` },
    });
  };

  const handleRedeemInvite = () => {
    setStep("complete-invite-profile");
  };

  const handleProfileChange = (field: keyof InviteProfileValues, value: string) => {
    setProfileValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleProfileContinue = () => {
    const nextErrors = validateInviteProfile();
    if (Object.keys(nextErrors).length) {
      setProfileErrors(nextErrors);
      return;
    }

    setProfileErrors({});
    setStep("complete-invite-avatar");
  };

  const handleAvatarContinue = () => {
    window.alert(
      JSON.stringify(
        {
          invite: inviteValidation,
          influencer: influencer
            ? {
                id: influencer.id,
                name: influencer.name,
                username: influencer.username,
              }
            : null,
          viewerState,
          profile: profileValues,
          avatar: avatarValues,
        },
        null,
        2,
      ),
    );
  };

  if (!influencer || loadingAuth || viewerState === "loading") {
    return (
      <div className={styles.pageContainer}>
        <BlockingLoader />
      </div>
    );
  }

  const isFormStep = step !== "landing";
  const shouldAutoFollow =
    viewerState === "not-following" && invitationValid;
  const waitingForAutoFollow =
    shouldAutoFollow &&
    (autoFollowState === "idle" || autoFollowState === "pending");
  const existingAccountMode =
    shouldAutoFollow && autoFollowState === "complete";
  const existingAccountFollowFailed =
    shouldAutoFollow && autoFollowState === "failed";

  if (!heroReady || waitingForAutoFollow) {
    return (
      <div className={styles.pageContainer}>
        <BlockingLoader />
        {landingAssets?.hero_png_url && (
          <img
            src={landingAssets.hero_png_url}
            srcSet={
              landingAssets.hero_png_2x_url
                ? `${landingAssets.hero_png_url} 1x, ${landingAssets.hero_png_2x_url} 2x`
                : undefined
            }
            onLoad={() => setHeroReady(true)}
            onError={() => setHeroReady(true)}
            className={styles.hiddenPreload}
            alt=""
          />
        )}
      </div>
    );
  }

  return (
    <>
      <DisclaimerModal
        isOpen={showDisclaimer}
        onClose={() => setShowDisclaimer(false)}
        onEnter={() => {
          storage.setBoolean(LocalStorageKeys.DisclaimerSeen, true);
          setShowDisclaimer(false);
        }}
        onExit={() => {
          setShowDisclaimer(false);
          navigate(Paths.underage);
        }}
      />
      <div className={styles.pageContainer}>
        <div
          className={`${styles.outerContainer} ${
            isFormStep ? styles.formOuterContainer : ""
          }`}
        >
          <InfluencerWelcomeVisuals
            influencer={influencer}
            landingAssets={landingAssets}
            onHeroLoad={() => setHeroReady(true)}
            className={isFormStep ? styles.hideVisualsOnMobile : undefined}
          />

          <section
            className={`${styles.contentContainer} ${
              isFormStep ? styles.formContentContainer : ""
            }`}
          >
            {step === "landing" && (
              <VipLandingStep
                influencer={influencer}
                email={inviteValidation.email}
                invitationValid={invitationValid}
                invitationExpired={invitationExpired}
                existingAccountMode={existingAccountMode}
                existingAccountFollowFailed={existingAccountFollowFailed}
                showLoginFooter={viewerState === "guest"}
                onRedeemInvite={handleRedeemInvite}
                onRetryAutoFollow={() => {
                  setAutoFollowState("idle");
                  setAutoFollowRetryKey((value) => value + 1);
                }}
                onContinueToInfluencer={() => navigate(Paths.home)}
                onLogin={handleLogin}
              />
            )}

            {step === "complete-invite-profile" && (
              <VipProfileStep
                values={profileValues}
                errors={profileErrors}
                onChange={handleProfileChange}
                onBlur={validateInviteField}
                onDecline={() => setStep("landing")}
                onContinue={handleProfileContinue}
              />
            )}

            {step === "complete-invite-avatar" && (
              <VipAvatarStep
                values={avatarValues}
                onBack={() => setStep("complete-invite-profile")}
                onGenderSelect={(gender) =>
                  setAvatarValues((prev) => ({ ...prev, gender }))
                }
                onSelectAvatar={() => setShowAvatarPicker(true)}
                onContinue={handleAvatarContinue}
              />
            )}
          </section>
        </div>
      </div>
      <AvatarPicker
        isOpen={showAvatarPicker}
        onClose={() => setShowAvatarPicker(false)}
        onSelect={(avatarUrl) => {
          setAvatarValues((prev) => ({ ...prev, avatarUrl }));
        }}
      />
    </>
  );
}
