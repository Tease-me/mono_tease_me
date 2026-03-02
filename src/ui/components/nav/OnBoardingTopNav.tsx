import React from 'react';
import styles from "./OnBoardingTopNav.module.css"
import BackArrowIcon from "@/assets/svg/ArrowLeft.svg?react"
import TeaseMeLogo from "@/ui/components/logos/TeaseMeLogo";
import { useNavigate } from 'react-router-dom';
import { Paths } from "@/routes/path";

interface OnBoardingTopNavProps {
    onBackClicked?: () => void;
}

const OnBoardingTopNav: React.FC<OnBoardingTopNavProps> = ({ onBackClicked }) => {
    const navigate = useNavigate();
    return (
        <div className={styles["top-nav"]}>
            <div className={styles["left-container"]}>
                {onBackClicked && <BackArrowIcon onClick={onBackClicked} />}
            </div>
            <div className={styles["right-container"]}>
                <TeaseMeLogo onClick={() => navigate(Paths.root)} variant='full-dark' />
            </div>
        </div>
    );
};

export default OnBoardingTopNav;
