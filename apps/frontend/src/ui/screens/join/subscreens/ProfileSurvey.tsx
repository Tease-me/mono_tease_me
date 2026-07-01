import { RegisterResponse } from "@/api/models/auth";
import PrimaryButton from "@/ui/components/inputs/buttons/PrimaryButton";
import AutocompleteInput from "@/ui/components/inputs/autocomplete/AutocompleteInput";
import ChipMultiSelect from "@/ui/components/inputs/autocomplete/ChipMultiSelect";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { apiClient } from "@/api/apis";
import { Endpoints } from "@/api/urls";
import { AuthServicesPreInfluencer } from "@/api/services/AuthServicesPreInfluencer";
import { LocalStorageKeys } from "@/constants/localStorageKeys";
import { filterCountries, isKnownCountry } from "@/data/countries";
import { Paths } from "@/routes/path";
import {
  buildRegisterSurveyAnswers,
  validateRegisterEmail,
} from "@/ui/screens/join/utils/registerSurveyAnswers";
import SocialMediaStep from "@/ui/screens/influencer-survey/components/SocialMediaStep";
import socialStepStyles from "@/ui/screens/influencer-survey/components/SocialMediaStep.module.css";
import { validateSocialStep } from "@/ui/screens/influencer-survey/validation/surveyValidation";
import { THANK_YOU_VARIANTS } from "@/ui/screens/join/subscreens/thankYouVariants";
import { storage } from "@/utils/storage";
import SvgPack from "@/utils/SvgPack";
import "./ProfileSurvey.css";

const PreInfluencerAPI = AuthServicesPreInfluencer(apiClient);

type ProfileSurveyProps = {
  initialEmail?: string;
};

const ProfileSurvey: React.FC<ProfileSurveyProps> = ({ initialEmail = "" }) => {
  const navigate = useNavigate();

  const inviteeEmailFromStorage = useMemo(() => {
    const attribution = storage.getObject<{ inviteeEmail?: string }>(
      LocalStorageKeys.JoinAttribution,
    );
    return initialEmail || attribution?.inviteeEmail || "";
  }, [initialEmail]);

  const inviteCodeFromStorage = useMemo(() => {
    const attribution = storage.getObject<{ inviteCode?: string }>(
      LocalStorageKeys.JoinAttribution,
    );
    return attribution?.inviteCode || "";
  }, []);

  const [name, setName] = useState("");
  const [countryQuery, setCountryQuery] = useState("");
  const [country, setCountry] = useState("");
  const [username, setUsername] = useState("");
  const [email] = useState(() => inviteeEmailFromStorage.trim().toLowerCase());
  const [languages, setLanguages] = useState<string[]>([]);
  const [socialAnswers, setSocialAnswers] = useState<Record<string, unknown>>({});
  const [verifyingSocial, setVerifyingSocial] = useState<Record<string, boolean>>(
    {},
  );
  const [socialError, setSocialError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingResume, setIsCheckingResume] = useState(true);

  const [errors, setErrors] = useState<{
    name?: string;
    country?: string;
    username?: string;
    email?: string;
    languages?: string;
    general?: string;
  }>({});

  const countryOptions = useMemo(
    () => filterCountries(countryQuery || country),
    [countryQuery, country],
  );

  const generateTempPassword = (length: number = 6): string => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    let pwd = "";
    for (let i = 0; i < length; i++) {
      pwd += chars[Math.floor(Math.random() * chars.length)];
    }
    return pwd;
  };

  const clearJoinAttribution = () => {
    storage.remove(LocalStorageKeys.JoinAttribution);
    storage.remove(LocalStorageKeys.ParentRefId);
  };

  const redirectToOnboarding = useCallback(
    (onboardingUrl: string) => {
      clearJoinAttribution();

      try {
        const nextUrl = new URL(onboardingUrl, window.location.origin);
        nextUrl.searchParams.set("start_step", "picture");
        window.location.assign(nextUrl.toString());
        return;
      } catch {
        const nextUrl = new URL(
          onboardingUrl.startsWith("/") ? onboardingUrl : `/${onboardingUrl}`,
          window.location.origin,
        );
        nextUrl.searchParams.set("start_step", "picture");
        navigate(`${nextUrl.pathname}${nextUrl.search}`);
      }
    },
    [navigate],
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const normalizedEmail = inviteeEmailFromStorage.trim().toLowerCase();
      if (!normalizedEmail) {
        setIsCheckingResume(false);
        return;
      }

      try {
        const { data } = await apiClient.get<{
          registered: boolean;
          onboarding_url?: string | null;
        }>(Endpoints.pre_influencers.inviteResume, {
          skipAuth: true,
          params: {
            invitee_email: normalizedEmail,
            ...(inviteCodeFromStorage
              ? { invite_code: inviteCodeFromStorage }
              : {}),
          },
        });

        if (
          !cancelled &&
          data.registered &&
          typeof data.onboarding_url === "string" &&
          data.onboarding_url.trim()
        ) {
          redirectToOnboarding(data.onboarding_url.trim());
          return;
        }
      } catch (err) {
        console.error(err);
      }

      if (!cancelled) {
        setIsCheckingResume(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [inviteeEmailFromStorage, inviteCodeFromStorage, redirectToOnboarding]);

  const onSocialAnswerChange = useCallback((key: string, value: unknown) => {
    setSocialAnswers((prev) => ({ ...prev, [key]: value }));
    setSocialError(null);
  }, []);

  const onVerifyingSocialChange = useCallback((platform: string, verifying: boolean) => {
    setVerifyingSocial((prev) => ({ ...prev, [platform]: verifying }));
  }, []);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const newErrors: typeof errors = {};

    if (!name.trim()) newErrors.name = "Full name is required";

    if (!country.trim() || !isKnownCountry(country)) {
      newErrors.country = "Please select a country from the list";
    }

    if (!username.trim()) {
      newErrors.username = "Username is required";
    } else if (username.length < 3) {
      newErrors.username = "Username must be at least 3 characters";
    } else if (!/^[a-z0-9_.]+$/.test(username)) {
      newErrors.username =
        "Use lowercase letters, numbers, underscores and dots (e.g. yourname_stagename)";
    }

    const emailError = validateRegisterEmail(email, inviteeEmailFromStorage);
    if (emailError) newErrors.email = emailError;

    if (languages.length === 0) {
      newErrors.languages = "Add at least one language";
    }

    const socialValidation = validateSocialStep(socialAnswers as Record<string, any>);
    if (!socialValidation.valid) {
      setSocialError(
        socialValidation.errors.social_media ?? "OnlyFans is required",
      );
    } else {
      setSocialError(null);
    }

    if (Object.keys(newErrors).length || !socialValidation.valid) {
      setErrors(newErrors);
      return;
    }

    const tempPassword = generateTempPassword(6);

    setIsSubmitting(true);
    try {
      const response: RegisterResponse = await PreInfluencerAPI.register({
        full_name: name.trim(),
        location: country.trim(),
        username: username.trim(),
        email,
        password: tempPassword,
        survey_answers: buildRegisterSurveyAnswers({
          country: country.trim(),
          username: username.trim(),
          languages,
          socialAnswers,
        }),
      });

      if (response.ok) {
        const onboardingUrl = response.onboarding_url?.trim();
        clearJoinAttribution();

        if (onboardingUrl) {
          redirectToOnboarding(onboardingUrl);
          return;
        }

        if (response.token && response.temp_password) {
          const params = new URLSearchParams({
            token: response.token,
            temp_password: response.temp_password,
            start_step: "picture",
          });
          navigate(`${Paths.joinOnboarding}?${params.toString()}`);
          return;
        }

        navigate(`${Paths.thankYou}?variant=${THANK_YOU_VARIANTS.received}`);
        return;
      }

      setErrors({
        general:
          (response as RegisterResponse & { message?: string }).message ||
          "Registration failed, please try again later",
      });
    } catch (err) {
      console.error(err);
      setErrors({
        general: "Unexpected error, please try again later",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const emailFieldError =
    errors.email ||
    (!email ? "Open this page from your invitation link to continue." : undefined);

  if (isCheckingResume) {
    return null;
  }

  return (
    <div className="ps-screen">
      <div className="ps-frame">
        <div className="ps-card">
          <header className="ps-header">
            <h2 className="ps-title">Your profile</h2>
            <p className="ps-subtitle">
              Tell us who you are, your languages, and where fans can find you.
            </p>
          </header>

          {errors.general && (
            <div className="ps-banner ps-banner--error" role="alert">
              {errors.general}
            </div>
          )}

          <div className="ps-body">
            <div className="ps-body-main">
              <div className="ps-field">
                <label className="ps-label" htmlFor="ps-full-name">
                  Full Name <span className="ps-required">*</span>
                </label>
                {errors.name && <span className="ps-field-error">{errors.name}</span>}
                <input
                  id="ps-full-name"
                  className="ps-input"
                  placeholder="Your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="ps-field">
                <label className="ps-label" htmlFor="ps-email">
                  Email <span className="ps-required">*</span>
                </label>
                {emailFieldError && <span className="ps-field-error">{emailFieldError}</span>}
                <input
                  id="ps-email"
                  className="ps-input ps-input--readonly"
                  value={email}
                  type="email"
                  readOnly
                  disabled
                  autoComplete="email"
                />
              </div>

              <div className="ps-field">
                <label className="ps-label" htmlFor="ps-username">
                  Username <span className="ps-required">*</span>
                </label>
                <p className="ps-help">Lowercase with underscore, e.g. yourname_stagename</p>
                {errors.username && <span className="ps-field-error">{errors.username}</span>}
                <input
                  id="ps-username"
                  className="ps-input"
                  placeholder="yourname_stagename"
                  value={username}
                  onChange={(e) => {
                    const sanitized = e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9_.]/g, "");
                    setUsername(sanitized);
                  }}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </div>

              <div className="ps-field">
                <label className="ps-label" htmlFor="ps-country">
                  Country <span className="ps-required">*</span>
                </label>
                {errors.country && <span className="ps-field-error">{errors.country}</span>}
                <AutocompleteInput
                  id="ps-country"
                  value={countryQuery || country}
                  onChange={(v) => {
                    setCountryQuery(v);
                    if (!v.trim()) setCountry("");
                  }}
                  onSelect={(v) => {
                    setCountry(v);
                    setCountryQuery(v);
                  }}
                  options={countryOptions}
                  placeholder="Search country"
                  aria-label="Country"
                />
              </div>

              <div className="ps-field ps-field--languages">
                <label className="ps-label">
                  Languages <span className="ps-required">*</span>
                </label>
                <p className="ps-help">Add all languages you create content in</p>
                {errors.languages && <span className="ps-field-error">{errors.languages}</span>}
                <ChipMultiSelect selected={languages} onChange={setLanguages} />
              </div>
            </div>

            <aside className="ps-body-side">
              <h3 className="ps-section-title">Social media</h3>
              <p className="ps-help">
                OnlyFans is required. You can also connect other platforms to help us verify your audience.
              </p>
              <SocialMediaStep
                answers={socialAnswers as Record<string, any>}
                socialError={socialError}
                verifyingSocial={verifyingSocial}
                onAnswerChange={onSocialAnswerChange}
                onVerifyingSocialChange={onVerifyingSocialChange}
                gridClassName={socialStepStyles.socialGridRegister}
              />
            </aside>
          </div>

          <div className="ps-footer">
          <div className="tm-survey-button-container">
            <PrimaryButton
              onClick={handleSubmit}
              text="Next"
              rightIcon={<SvgPack.ArrowRight />}
              loading={isSubmitting}
              disabled={!email || Boolean(emailFieldError)}
            />
          </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileSurvey;
