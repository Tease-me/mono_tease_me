import CheckBox from "@/ui/components/inputs/check-boxes/CheckBox";
import NormalButton from "@/ui/components/inputs/buttons/NormalButton";
import PrimaryButton from "@/ui/components/inputs/buttons/PrimaryButton";
import TextInput from "@/ui/components/inputs/text-inputs/TextInput";
import ButtonRow from "@/ui/templates/ButtonRow";
import SvgPack from "@/utils/SvgPack";
import clsx from "clsx";
import styles from "./RegisterStepForm.module.css";

type AccountValues = {
  email: string;
  password: string;
  confirmPassword: string;
  agree: boolean;
};

type AccountErrors = {
  email?: string;
  password?: string;
  confirmPassword?: string;
  general?: string;
};

type RegisterStepFormProps = {
  values: AccountValues;
  errors: AccountErrors;
  onChange: (field: keyof AccountValues, value: string | boolean) => void;
  onBlur: (field: "email" | "password" | "confirmPassword") => void;
  onContinue: () => void;
  onBack: () => void;
  onSignIn: () => void;
};

export default function RegisterStepForm({
  values,
  errors,
  onChange,
  onBlur,
  onContinue,
  onBack,
  onSignIn,
}: RegisterStepFormProps) {
  return (
    <form className={styles["auth-form"]} onSubmit={(e) => e.preventDefault()}>
      <div className={styles["input-fields"]}>
        <div className={clsx(styles["input-field"], styles["email-field"])}>
          <TextInput
            leftIcon={<SvgPack.Message />}
            type="email"
            placeholder="Email"
            value={values.email}
            onChange={(e) =>
              onChange("email", (e.target as HTMLInputElement).value)
            }
            onBlur={() => onBlur("email")}
            autoComplete="email"
          />
          {errors.email && <span className={styles["error"]}>{errors.email}</span>}
        </div>
        <div className={styles["input-field"]}>
          <TextInput
            leftIcon={<SvgPack.Lock />}
            type="password"
            placeholder="Password"
            value={values.password}
            onChange={(e) =>
              onChange("password", (e.target as HTMLInputElement).value)
            }
            onBlur={() => onBlur("password")}
            autoComplete="new-password"
          />
          {errors.password && (
            <span className={styles["error"]}>{errors.password}</span>
          )}
        </div>
        <div className={styles["input-field"]}>
          <TextInput
            leftIcon={<SvgPack.Lock />}
            type="password"
            placeholder="Confirm Password"
            value={values.confirmPassword}
            onChange={(e) =>
              onChange("confirmPassword", (e.target as HTMLInputElement).value)
            }
            onBlur={() => onBlur("confirmPassword")}
            autoComplete="new-password"
          />
          {errors.confirmPassword && (
            <span className={styles["error"]}>{errors.confirmPassword}</span>
          )}
        </div>
      </div>
      <CheckBox
        className={styles["check-box"]}
        checked={values.agree}
        onChange={() => onChange("agree", !values.agree)}
      >
        I am over 18
      </CheckBox>
      {errors.general && <span className={styles["error"]}>{errors.general}</span>}
      <div className={styles["user-action-section"]}>
        <div className={styles["auth-buttons"]}>
          <ButtonRow>
            <NormalButton
              className={styles["btn-back"]}
              onClick={onBack}
              text="Back"
              color="black"
            />
            <PrimaryButton
              className={styles["btn-primary"]}
              text="Continue"
              onClick={onContinue}
            />
          </ButtonRow>
        </div>
        <p className={styles["auth-footer"]}>
          Already have an account? <span onClick={onSignIn}>Sign in</span>
        </p>
      </div>
    </form>
  );
}
