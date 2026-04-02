import ProfileMedia from "@/ui/components/ProfileMedia";
import IconButton from "@/ui/components/inputs/buttons/IconButton";
import NormalButton from "@/ui/components/inputs/buttons/NormalButton";
import PrimaryButton from "@/ui/components/inputs/buttons/PrimaryButton";
import DateInput from "@/ui/components/inputs/text-inputs/DateInput";
import TextInput from "@/ui/components/inputs/text-inputs/TextInput";
import SvgPack from "@/utils/SvgPack";
import styles from "./UpdateProfileStepForm.module.css";
import { Suspense, useRef } from "react";
import ValidationPill from "@/ui/components/inputs/buttons/ValidationPill";

type ProfileValues = {
  fullName: string;
  userName: string;
  gender: "male" | "female";
  dateOfBirth: string;
  profilePhotoFile: File | null;
};

type ProfileErrors = {
  fullName?: string;
  userName?: string;
  gender?: string;
  dateOfBirth?: string;
  general?: string;
};

type UpdateProfileStepFormProps = {
  values: ProfileValues;
  errors: ProfileErrors;
  onChange: (field: "fullName" | "userName" | "dateOfBirth", value: string) => void;
  onGenderSelect: (value: "male" | "female") => void;
  onBlur: (field: "fullName" | "userName" | "dateOfBirth") => void;
  onBack: () => void;
  onSubmit: () => void;
  handleEditProfileMediaClicked: () => void;
  onProfilePhotoChange: (file: File | null) => void;
  onSelectAvatar?: () => void;
  selectedAvatarUrl?: string;
};

export default function UpdateProfileStepForm({
  values,
  errors,
  onChange,
  onGenderSelect,
  onBlur,
  onBack,
  onSubmit,
  handleEditProfileMediaClicked,
  onProfilePhotoChange,
  onSelectAvatar,
  selectedAvatarUrl,
}: UpdateProfileStepFormProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewUrl = values.profilePhotoFile
    ? URL.createObjectURL(values.profilePhotoFile)
    : selectedAvatarUrl;

  return (
    <div className={styles["two-column-layout"]}>
      <div className={styles["left-column"]}>
        <div className={styles["avatar-wrapper"]}>
          <ProfileMedia
            mediaType="image"
            size="large"
            imageSrc={previewUrl}
            onEditClick={() => {
              handleEditProfileMediaClicked();
              fileInputRef.current?.click();
            }}
          />
          <IconButton
            color="black"
            type="pill"
            text="Select avatar"
            onClick={onSelectAvatar}
            className={styles["select-avatar-btn"]}
            leftIcon={
              <Suspense fallback={null}>
                <SvgPack.PlusRed />
              </Suspense>
            }
          />
        </div>
        <input
          ref={fileInputRef}
          className={styles["file-input"]}
          type="file"
          accept="image/*"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            onProfilePhotoChange(file);
          }}
        />
      </div>
      <div className={styles["right-column"]}>
        <form className={styles["auth-form"]} onSubmit={(e) => e.preventDefault()}>
          <div className={styles["gender-selection"]}>
            <h2 className={styles["section-title"]}>Are you male or female?</h2>
            <div className={styles["gender-buttons"]}>
              <IconButton
                leftIcon={<Suspense fallback={null}><SvgPack.Male /></Suspense>}
                orientation="vertical"
                text="Male"
                type="square"
                color={values.gender === "male" ? "pink" : "black"}
                onClick={() => onGenderSelect("male")}
              />
              <IconButton
                leftIcon={<Suspense fallback={null}><SvgPack.Female /></Suspense>}
                orientation="vertical"
                text="Female"
                type="square"
                color={values.gender === "female" ? "pink" : "black"}
                onClick={() => onGenderSelect("female")}
              />
            </div>
            {errors.gender && (
              <span className={styles["error"]}>{errors.gender}</span>
            )}
          </div>
          <TextInput
            type="text"
            placeholder="Full Name"
            value={values.fullName}
            onChange={(e) =>
              onChange("fullName", (e.target as HTMLInputElement).value)
            }
            onBlur={() => onBlur("fullName")}
          />
          {errors.fullName && (
            <span className={styles["error"]}>{errors.fullName}</span>
          )}
          <TextInput
            type="text"
            placeholder="Nick Name"
            value={values.userName}
            onChange={(e) =>
              onChange("userName", (e.target as HTMLInputElement).value)
            }
            onBlur={() => onBlur("userName")}
            autoComplete="username"
          />
          {errors.userName && (
            <span className={styles["error"]}>{errors.userName}</span>
          )}
          <DateInput
            placeholder="Date of Birth"
            value={values.dateOfBirth}
            onChange={(value) => onChange("dateOfBirth", value)}
            onBlur={() => onBlur("dateOfBirth")}
          />
          {errors.dateOfBirth && (
            <span className={styles["error"]}>{errors.dateOfBirth}</span>
          )}

          {errors.general && (
            <ValidationPill variant="error" className={styles["errorPill"]}>
              {errors.general}
            </ValidationPill>
          )}
          <div className={styles["auth-buttons"]}>
            <NormalButton text="Back" onClick={onBack} className={styles["btn-back"]} style={{ height: "auto" }} />
            <PrimaryButton
              text="Continue"
              onClick={onSubmit}
              className={styles["btn-primary"]}
            />
          </div>
        </form>
      </div>
    </div>
  );
}
