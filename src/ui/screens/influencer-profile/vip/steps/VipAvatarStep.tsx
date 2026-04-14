import IconButton from "@/ui/components/inputs/buttons/IconButton";
import NormalButton from "@/ui/components/inputs/buttons/NormalButton";
import PrimaryButton from "@/ui/components/inputs/buttons/PrimaryButton";
import ProfileMedia from "@/ui/components/ProfileMedia";
import SvgPack from "@/utils/SvgPack";
import { Suspense } from "react";
import styles from "./VipAvatarStep.module.css";

type VipAvatarStepProps = {
  values: {
    gender: "male" | "female";
    avatarUrl?: string;
  };
  onBack: () => void;
  onGenderSelect: (value: "male" | "female") => void;
  onSelectAvatar: () => void;
  onContinue: () => void;
};

export default function VipAvatarStep({
  values,
  onBack,
  onGenderSelect,
  onSelectAvatar,
  onContinue,
}: VipAvatarStepProps) {
  return (
    <section className={styles.panel}>
      <h1 className={styles.title}>Complete your invite</h1>

      <div className={styles.avatarArea}>
        <div className={styles.avatarWrapper}>
          <ProfileMedia
            mediaType="image"
            size="large"
            imageSrc={values.avatarUrl}
            glow
          />
          <IconButton
            color="black"
            type="pill"
            text="Select Avatar"
            onClick={onSelectAvatar}
            className={styles.selectAvatarButton}
            leftIcon={
              <Suspense fallback={null}>
                <SvgPack.PlusRed />
              </Suspense>
            }
          />
        </div>
      </div>

      <div className={styles.genderSection}>
        <h2 className={styles.genderTitle}>Are you male or female?</h2>
        <div className={styles.genderButtons}>
          <IconButton
            leftIcon={
              <Suspense fallback={null}>
                <SvgPack.Male />
              </Suspense>
            }
            orientation="vertical"
            text="Male"
            type="square"
            color={values.gender === "male" ? "pink" : "black"}
            onClick={() => onGenderSelect("male")}
            className={styles.genderButton}
          />
          <IconButton
            leftIcon={
              <Suspense fallback={null}>
                <SvgPack.Female />
              </Suspense>
            }
            orientation="vertical"
            text="Female"
            type="square"
            color={values.gender === "female" ? "pink" : "black"}
            onClick={() => onGenderSelect("female")}
            className={styles.genderButton}
          />
        </div>
      </div>

      <div className={styles.actions}>
        <NormalButton text="Back" className={styles.button} onClick={onBack} />
        <PrimaryButton
          text="Continue"
          className={styles.button}
          onClick={onContinue}
        />
      </div>
    </section>
  );
}
