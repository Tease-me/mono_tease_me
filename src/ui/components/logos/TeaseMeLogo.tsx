import React from 'react';
import styles from "./TeaseMeLogo.module.css"
import teaseMeLogo from "@/assets/LogoTeaseMe-Light.svg";
import clsx from 'clsx';

interface TeaseMeLogoProps extends React.HTMLAttributes<HTMLDivElement> {
    size?: 'xsmall' | 'small' | 'medium' | 'large' | 'xlarge'
}

const TeaseMeLogo: React.FC<TeaseMeLogoProps> = ({ size = "medium" }) => {
    return (
        <img src={teaseMeLogo} alt="Tease Me Logo" className={clsx(styles["logo"], styles[size])} />
    );
};

export default TeaseMeLogo;