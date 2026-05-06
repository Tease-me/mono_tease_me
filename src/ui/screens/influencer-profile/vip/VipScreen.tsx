import { apiClient } from "@/api/apis";
import { InfluencerLandingAssetsResponse } from "@/api/models/influencers";
import { AuthServices } from "@/api/services/AuthServices";
import { FollowServices } from "@/api/services/FollowServices";
import { FunnelServices } from "@/api/services/FunnelServices";
import { InfluencerServices } from "@/api/services/InfluencerService";
import { LocalStorageKeys } from "@/constants/localStorageKeys";
import { PublicAssetPaths } from "@/constants/publicAssetPaths";
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
import {
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import VipVerifyEmailStep from "./steps/VipVerifyEmailStep";
import styles from "./VipScreen.module.css";

type VipStep =
  | "landing"
  | "complete-invite-profile"
  | "complete-invite-avatar"
  | "verify-email";
type InviteAvatarValues = {
  gender: "male" | "female";
  avatarUrl?: string;
};
type ViewerState = "loading" | "guest" | "following" | "not-following";
type AutoFollowState = "idle" | "pending" | "complete" | "failed";
type InviteStatus = "loading" | "valid" | "expired" | "invalid";

const influencerServices = InfluencerServices(apiClient);
const followServices = FollowServices(apiClient);
const funnelServices = FunnelServices(apiClient);
const authServices = AuthServices(apiClient);

export default function VipScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { username } = useParams<{ username: string }>();
  const [searchParams] = useSearchParams();
  const influencerRepo = useMemo(() => InfluencerRepo(), []);
  const { isSignedIn, loadingAuth } = useContext(AuthContext);

  const inviteCode = searchParams.get("invite");
  const token = searchParams.get("t") ?? "";
  const [inviteStatus, setInviteStatus] = useState<InviteStatus>("loading");
  const invitationValid = inviteStatus === "valid";
  const invitationExpired = inviteStatus === "expired";
  const [step, setStep] = useState<VipStep>("landing");
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [profileValues, setProfileValues] = useState<InviteProfileValues>({
    userName: "",
    fullName: "",
    dateOfBirth: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [avatarValues, setAvatarValues] = useState<InviteAvatarValues>(() => {
    const folder = Math.random() < 0.5 ? "human" : "animal";
    const index = Math.floor(Math.random() * 12) + 1;

    return {
      gender: "male",
      avatarUrl: PublicAssetPaths.avatarImage(folder, index),
    };
  });
  const [profileErrors, setProfileErrors] = useState<InviteProfileErrors>({});
  const [registrationError, setRegistrationError] = useState<string>();
  const [verificationMessage, setVerificationMessage] = useState<string>();
  const [verificationEmail, setVerificationEmail] = useState("");
  const [isSubmittingRegistration, setIsSubmittingRegistration] =
    useState(false);
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

  const applyInvitePrefill = (response: {
    email: string;
    full_name: string | null;
    user_name: string | null;
    profile_photo_url: string | null;
    gender: string | null;
    date_of_birth: string | null;
  }) => {
    setProfileValues((prev) => ({
      ...prev,
      email: response.email ?? "",
      fullName: response.full_name ?? "",
      userName: response.user_name ?? "",
      dateOfBirth: response.date_of_birth ?? "",
    }));

    setAvatarValues((prev) => ({
      gender:
        response.gender === "male" || response.gender === "female"
          ? response.gender
          : prev.gender,
      avatarUrl: response.profile_photo_url ?? prev.avatarUrl,
    }));
  };

  useEffect(() => {
    if (
      inviteCode &&
      (viewerState === "guest" || viewerState === "not-following")
    ) {
      void funnelServices.reportEvent("link_clicked", inviteCode);
    }
  }, [inviteCode, viewerState]);

  useEffect(() => {
    let cancelled = false;
    const inviteToken = token.trim();

    setInviteStatus("loading");

    if (!inviteToken) {
      setInviteStatus("invalid");
      return;
    }

    void authServices
      .checkToken(inviteToken)
      .then((response) => {
        if (cancelled) return;
        applyInvitePrefill(response);
        setInviteStatus(response.ok && response.valid ? "valid" : "invalid");
      })
      .catch((error) => {
        logger.debug(error);
        if (cancelled) return;
        setInviteStatus(error?.status === 410 ? "expired" : "invalid");
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

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

  const cleanErrors = <T extends Record<string, string | undefined>>(
    errors: T,
  ) =>
    Object.fromEntries(
      Object.entries(errors).filter(
        ([, value]) => value !== undefined && value !== "",
      ),
    ) as Partial<T>;

  const getProfileCompletionError = (err: any) => {
    const detail = err?.detail || err?.response?.data?.detail;

    if (typeof detail === "string" && detail.trim()) return detail;

    if (Array.isArray(detail)) {
      const firstMessage = detail.find(
        (item) => typeof item?.msg === "string" && item.msg.trim(),
      )?.msg;
      if (firstMessage) return firstMessage;
    }

    const message = err?.message || err?.response?.data?.message;
    if (typeof message === "string" && message.trim()) return message;

    return "Profile completion failed. Please try again later.";
  };

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
        password: profileValues.password,
        confirmPassword: profileValues.confirmPassword,
      },
      {
        userName: validationRules.username,
        fullName: required("Full name"),
        dateOfBirth: required("Date of birth"),
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
    if (field === "password") error = validationRules.password(value);
    if (field === "confirmPassword") {
      error = validationRules.password(value);
      if (
        !error &&
        profileValues.password &&
        value &&
        profileValues.password !== value
      ) {
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

  const handleProfileChange = (
    field: keyof InviteProfileValues,
    value: string,
  ) => {
    setProfileValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleProfileContinue = () => {
    const nextErrors = validateInviteProfile();
    if (Object.keys(nextErrors).length) {
      setProfileErrors(nextErrors);
      return;
    }

    setProfileErrors({});
    setRegistrationError(undefined);
    setStep("complete-invite-avatar");
  };

  const handleAvatarContinue = async () => {
    if (isSubmittingRegistration) return;

    const nextErrors = validateInviteProfile();
    if (Object.keys(nextErrors).length) {
      setProfileErrors(nextErrors);
      setStep("complete-invite-profile");
      return;
    }

    if (!invitationValid) {
      setRegistrationError("This invite is no longer available.");
      return;
    }

    if (!influencer?.id) {
      setRegistrationError("Registration is unavailable. Please try again.");
      return;
    }

    setRegistrationError(undefined);
    setIsSubmittingRegistration(true);

    try {
      const absoluteAvatarUrl = avatarValues.avatarUrl
        ? new URL(avatarValues.avatarUrl, window.location.origin).toString()
        : null;
      const response = await authServices.completeProfile({
        token: token.trim(),
        password: profileValues.password,
        influencer_id: influencer.id,
        full_name: profileValues.fullName,
        gender: avatarValues.gender,
        user_name: profileValues.userName,
        date_of_birth: profileValues.dateOfBirth,
        profile_photo_url: absoluteAvatarUrl,
        invite_code: inviteCode,
      });

      storage.set(LocalStorageKeys.SelectedId, influencer.id.toString());
      setVerificationEmail(response.email || "");
      setVerificationMessage(response.message);
      setStep("verify-email");
    } catch (err: any) {
      setRegistrationError(getProfileCompletionError(err));
    } finally {
      setIsSubmittingRegistration(false);
    }
  };

  if (
    !influencer ||
    loadingAuth ||
    viewerState === "loading" ||
    inviteStatus === "loading"
  ) {
    return (
      <div className={styles.pageContainer}>
        <BlockingLoader />
      </div>
    );
  }

  const isVerificationStep = step === "verify-email";
  const isFormStep = step !== "landing";
  const shouldAutoFollow = viewerState === "not-following" && invitationValid;
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
            isVerificationStep
              ? styles.fullOuterContainer
              : isFormStep
                ? styles.formOuterContainer
                : ""
          }`}
        >
          {!isVerificationStep && (
            <InfluencerWelcomeVisuals
              influencer={influencer}
              landingAssets={landingAssets}
              onHeroLoad={() => setHeroReady(true)}
              className={isFormStep ? styles.hideVisualsOnMobile : undefined}
            />
          )}

          <section
            className={`${styles.contentContainer} ${
              isVerificationStep
                ? styles.fullContentContainer
                : isFormStep
                  ? styles.formContentContainer
                  : ""
            }`}
          >
            {step === "landing" && (
              <VipLandingStep
                influencer={influencer}
                profileValues={profileValues}
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
                isSubmitting={isSubmittingRegistration}
                error={registrationError}
              />
            )}

            {step === "verify-email" && (
              <VipVerifyEmailStep
                email={verificationEmail}
                message={verificationMessage}
                onVerified={() => navigate(Paths.login)}
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
