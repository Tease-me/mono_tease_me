import React from 'react';
import styles from "./TeaseMeLogo.module.css"
import teaseMeLogo from "@/assets/logos/LogoTeaseMe-Light.svg";
import teaseMeIcon from "@/assets/logos/3D-IconTeaseMe-Light.svg";
import clsx from 'clsx';

interface TeaseMeLogoProps extends React.HTMLAttributes<HTMLDivElement> {
    size?: 'xsmall' | 'small' | 'medium' | 'large' | 'xlarge';
    variant?: 'full' | 'icon-only';
}

const TeaseMeLogo: React.FC<TeaseMeLogoProps> = ({ size = "medium", variant = 'full', ...rest }) => {
    const src = variant === 'icon-only' ? teaseMeIcon : teaseMeLogo;
    return (
        <img
            src={src}
            alt="Tease Me Logo"
            className={clsx(styles["logo"], styles[size], styles[variant])}
            {...rest}
        />
    );
};

export default TeaseMeLogo;