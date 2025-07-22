import React from 'react';
import styles from "./TeaseMeLogo.module.css"
import teaseMeLogo from "@/assets/logos/LogoTeaseMe-Light.svg";
import teaseMeIcon from "@/assets/logos/3D-IconTeaseMe-Light.svg";
import TeaseMeMonoLogo from "@/assets/logos/Flat-LogoTeaseMe-mono-currentColor.svg?react";
import TeaseMeMonoLipsOnly from "@/assets/logos/Flat-IconTeaseMe-LipsOnly-mono-black.svg?react";
import clsx from 'clsx';

interface TeaseMeLogoProps extends React.HTMLAttributes<HTMLDivElement> {
    size?: 'xsmall' | 'small' | 'medium' | 'large' | 'xlarge';
    variant?: 'full' | 'icon-only' | 'mono-full' | 'mono-lips-only';
}

const TeaseMeLogo: React.FC<TeaseMeLogoProps> = ({ size = "medium", variant = 'full', ...rest }) => {
    const variantToSrc: Record<'full' | 'icon-only', string> = {
        full: teaseMeLogo,
        'icon-only': teaseMeIcon,
    };

    if (variant === 'mono-full') {
        return (
            <div className={clsx(styles["logo"], styles[size], styles[variant])}
                aria-label={`${variant.replace('-', ' ')} Tease Me Logo`}
                role="img"
                {...rest}>
                <TeaseMeMonoLogo />
            </div>
        );
    } else if (variant === 'mono-lips-only') {
        return (
            <div className={clsx(styles["logo"], styles[size], styles[variant])}
                aria-label={`${variant.replace('-', ' ')} Tease Me Logo`}
                role="img"
                {...rest}>
                <TeaseMeMonoLipsOnly />
            </div>
        );
    }

    return (
        <img
            src={variantToSrc[variant]}
            alt={`${variant.replace('-', ' ')} Tease Me Logo`}
            className={clsx(styles["logo"], styles[size], styles[variant])}
            {...rest}
        />
    );
};

export default TeaseMeLogo;