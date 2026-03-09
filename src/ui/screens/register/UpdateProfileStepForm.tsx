import ProfileMedia from "@/ui/components/ProfileMedia";
import IconButton from "@/ui/components/inputs/buttons/IconButton";
import NormalButton from "@/ui/components/inputs/buttons/NormalButton";
import PrimaryButton from "@/ui/components/inputs/buttons/PrimaryButton";
import TextInput from "@/ui/components/inputs/text-inputs/TextInput";
import SvgPack from "@/utils/SvgPack";
import styles from "./UpdateProfileStepForm.module.css";
import { useRef } from "react";
import ValidationPill from "@/ui/components/inputs/buttons/ValidationPill";

type ProfileValues = {
  fullName: string;
  userName: string;
  gender: "male" | "female" | "";
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
}: UpdateProfileStepFormProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewUrl = values.profilePhotoFile
    ? URL.createObjectURL(values.profilePhotoFile)
    : undefined;

  return (
    <div className={styles["two-column-layout"]}>
      <div className={styles["left-column"]}>
        <ProfileMedia
          mediaType="image"
          size="xlarge"
          imageSrc={previewUrl}
          onEditClick={() => {
            handleEditProfileMediaClicked();
            fileInputRef.current?.click();
          }}
        />
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
                leftIcon={<SvgPack.Male />}
                orientation="vertical"
                text="Male"
                type="square"
                selected={values.gender === "male"}
                onClick={() => onGenderSelect("male")}
              />
              <IconButton
                leftIcon={<SvgPack.Female />}
                orientation="vertical"
                text="Female"
                type="square"
                selected={values.gender === "female"}
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
            placeholder="Username"
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
<div className={styles["CalendarContainer"]}>          <TextInput
            type="date"
            placeholder="Date of Birth"
            value={values.dateOfBirth}
            onChange={(e) =>
              onChange("dateOfBirth", (e.target as HTMLInputElement).value)
            }
            onBlur={() => onBlur("dateOfBirth")}
          /> <div className={styles["CalendarIcon"]}>
            <SvgPack.IconCalendar />
            
            </div></div>
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
