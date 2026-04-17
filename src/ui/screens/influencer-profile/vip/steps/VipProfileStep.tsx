import NormalButton from "@/ui/components/inputs/buttons/NormalButton";
import PrimaryButton from "@/ui/components/inputs/buttons/PrimaryButton";
import ValidationPill from "@/ui/components/inputs/buttons/ValidationPill";
import DateInput from "@/ui/components/inputs/text-inputs/DateInput";
import TextInput from "@/ui/components/inputs/text-inputs/TextInput";
import SvgPack from "@/utils/SvgPack";
import { ChangeEvent, Suspense, useState } from "react";
import styles from "./VipProfileStep.module.css";

export type InviteProfileValues = {
  userName: string;
  fullName: string;
  dateOfBirth: string;
  email: string;
  password: string;
  confirmPassword: string;
};

export type InviteProfileErrors = Partial<
  Record<keyof InviteProfileValues | "general", string>
>;

type VipProfileStepProps = {
  values: InviteProfileValues;
  errors: InviteProfileErrors;
  onChange: (field: keyof InviteProfileValues, value: string) => void;
  onBlur: (field: keyof InviteProfileValues) => void;
  onDecline: () => void;
  onContinue: () => void;
};

export default function VipProfileStep({
  values,
  errors,
  onChange,
  onBlur,
  onDecline,
  onContinue,
}: VipProfileStepProps) {
  const [showPasswords, setShowPasswords] = useState(false);
  const passwordType = showPasswords ? "text" : "password";
  const passwordIcon = (
    <button
      type="button"
      className={styles.eyeButton}
      onClick={() => setShowPasswords((value) => !value)}
      tabIndex={-1}
      aria-label={showPasswords ? "Hide password" : "Show password"}
    >
      <Suspense fallback={null}>
        {showPasswords ? <SvgPack.EyeOff /> : <SvgPack.Eye />}
      </Suspense>
    </button>
  );

  const handleTextChange =
    (field: keyof InviteProfileValues) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      onChange(field, event.target.value);
    };

  const fieldError = (field: keyof InviteProfileValues) =>
    errors[field] ? (
      <span className={styles.fieldError}>{errors[field]}</span>
    ) : null;

  return (
    <form
      className={styles.panel}
      onSubmit={(event) => {
        event.preventDefault();
        onContinue();
      }}
    >
      <h1 className={styles.title}>Complete your invite</h1>

      <div className={styles.identityGroup}>
        <div className={styles.nameRow}>
          <div className={styles.field}>
            <TextInput
              className={styles.input}
              placeholder="Nick Name"
              value={values.userName}
              onChange={handleTextChange("userName")}
              onBlur={() => onBlur("userName")}
              autoComplete="username"
            />
            {fieldError("userName")}
          </div>

          <div className={styles.field}>
            <TextInput
              className={styles.input}
              placeholder="Name"
              value={values.fullName}
              onChange={handleTextChange("fullName")}
              onBlur={() => onBlur("fullName")}
              autoComplete="name"
            />
            {fieldError("fullName")}
          </div>
        </div>

        <div className={styles.field}>
          <DateInput
            className={styles.input}
            placeholder="Date of Birth"
            value={values.dateOfBirth}
            onChange={(value) => onChange("dateOfBirth", value)}
            onBlur={() => onBlur("dateOfBirth")}
          />
          {fieldError("dateOfBirth")}
        </div>
      </div>

      <div className={styles.accountGroup}>
        <div className={styles.field}>
          <TextInput
            className={`${styles.input} ${styles.emailInput}`}
            type="email"
            placeholder="Email"
            value={values.email}
            leftIcon={
              <Suspense fallback={null}>
                <SvgPack.Message />
              </Suspense>
            }
            disabled
            readOnly
            autoComplete="email"
          />
          {fieldError("email")}
        </div>

        <div className={styles.passwordRow}>
          <div className={styles.field}>
            <TextInput
              className={styles.input}
              leftIcon={
                <Suspense fallback={null}>
                  <SvgPack.Lock />
                </Suspense>
              }
              leftIconStyles={{ style: { margin: "0 8px 0 12px" } }}
              rightIcon={passwordIcon}
              rightIconStyles={{ style: { margin: "0 12px 0 8px" } }}
              type={passwordType}
              placeholder="Password"
              value={values.password}
              onChange={handleTextChange("password")}
              onBlur={() => onBlur("password")}
              autoComplete="new-password"
            />
            {fieldError("password")}
          </div>

          <div className={styles.field}>
            <TextInput
              className={styles.input}
              leftIcon={
                <Suspense fallback={null}>
                  <SvgPack.Lock />
                </Suspense>
              }
              leftIconStyles={{ style: { margin: "0 8px 0 12px" } }}
              rightIcon={passwordIcon}
              rightIconStyles={{ style: { margin: "0 12px 0 8px" } }}
              type={passwordType}
              placeholder="Confirm"
              value={values.confirmPassword}
              onChange={handleTextChange("confirmPassword")}
              onBlur={() => onBlur("confirmPassword")}
              autoComplete="new-password"
            />
            {fieldError("confirmPassword")}
          </div>
        </div>

        <p className={styles.help}>Email and password will be used to login</p>
      </div>

      {errors.general && (
        <ValidationPill variant="error" className={styles.errorPill}>
          {errors.general}
        </ValidationPill>
      )}

      <div className={styles.actions}>
        <NormalButton
          text="Decline Invite"
          className={styles.button}
          onClick={onDecline}
        />
        <PrimaryButton
          text="Continue"
          className={styles.button}
          onClick={onContinue}
        />
      </div>
    </form>
  );
}
