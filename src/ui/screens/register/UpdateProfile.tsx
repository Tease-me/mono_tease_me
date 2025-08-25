import React from "react";
import { useNavigate } from "react-router-dom";
import BackgroundGradient from "../../templates/BackgroundGradient";
import styles from "./UpdateProfile.module.css";
import FullWidthLayout from "@/ui/templates/FullWidthLayout";
import HeadingText from "@/ui/components/typography/HeadingText";
import OnBoardingTopNav from "@/ui/components/nav/OnBoardingTopNav";
import IconButton from "@/ui/components/inputs/buttons/IconButton";
import SvgPack from "@/utils/SvgPack";
import NormalButton from "@/ui/components/inputs/buttons/NormalButton";
import PrimaryButton from "@/ui/components/inputs/buttons/PrimaryButton";
import TextInput from "@/ui/components/inputs/text-inputs/TextInput";
import ProfileMedia from "@/ui/components/ProfileMedia";

export default function UpdateProfile() {
  const navigate = useNavigate();

  const handleBackClick = () => {
    navigate("/")
  }

  return (
    <BackgroundGradient>
      <FullWidthLayout fullWidthNav={<OnBoardingTopNav onBackClicked={handleBackClick} />}>
        <HeadingText className={styles["title"]}>Create your Account</HeadingText>
        <div className={styles["two-column-layout"]}>
          <div className={styles["left-column"]}>
            <ProfileMedia mediaType='image' />
          </div>
          <div className={styles["right-column"]}>
            <form className={styles["auth-form"]}>
              <div className={styles["gender-selection"]}>
                <h2 className={styles["section-title"]}>Are you male or female?</h2>
                <IconButton leftIcon={<SvgPack.Male />} orientation="vertical" text="Male" type="square" selected />
                <IconButton leftIcon={<SvgPack.Female />} orientation="vertical" text="Female" type="square" />
              </div>
              <TextInput type="text" placeholder="Name" />
              <TextInput
                type="date"
                placeholder="Date of Birth"
              />
              <TextInput type="text" placeholder="Nickname" />
              <div className={styles["auth-buttons"]}>
                <NormalButton text="Back" onClick={() => navigate("/signup")} className={styles["btn-back"]} />
                <PrimaryButton text="Continue" onClick={() => navigate("/signup/success")} className={styles["btn-primary"]} />
              </div>
            </form>
          </div>
        </div>
      </FullWidthLayout>
    </BackgroundGradient >
  );
}
