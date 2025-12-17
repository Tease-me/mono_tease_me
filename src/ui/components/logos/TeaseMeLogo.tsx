import React, { ReactNode } from 'react';
import styles from "./TeaseMeLogo.module.css"
import teaseMeLogo from "@/assets/logos/LogoTeaseMe-Light.svg";
import teaseMeLogoDark from "@/assets/logos/LogoTeaseMeDarkMode.svg";
import teaseMeIcon from "@/assets/logos/3D-IconTeaseMe-Light.svg";
import TeaseMeMonoLogo from "@/assets/logos/Flat-LogoTeaseMe-mono-currentColor.svg?react";
import TeaseMeMonoLipsOnly from "@/assets/logos/Flat-IconTeaseMe-LipsOnly-mono-black.svg?react";
import TeaseMeMonoLipsOnlyStraight from "@/assets/logos/Flat-IconTeaseMe-LipChat-mono-default.svg?react";

import clsx from 'clsx';
type VariantType = 'full' | 'icon-only' | 'mono-full' | 'mono-lips-only' | 'full-dark' | 'icon-only-dark' | 'mono-lips-straight';

interface TeaseMeLogoProps extends React.HTMLAttributes<HTMLDivElement> {
    size?: 'xsmall' | 'small' | 'medium' | 'large' | 'xlarge';
    variant?: VariantType;
}

const TeaseMeLogo: React.FC<TeaseMeLogoProps> = ({ size = "medium", variant = 'full', ...rest }) => {
    const variantIcon: Record<VariantType, string | ReactNode> = {
        full: teaseMeLogo,
        'icon-only': teaseMeIcon,
        'full-dark': teaseMeLogoDark,
        'icon-only-dark': teaseMeIcon,
        'mono-full': <TeaseMeMonoLogo />,
        'mono-lips-only': <TeaseMeMonoLipsOnly />,
        'mono-lips-straight': <TeaseMeMonoLipsOnlyStraight />
    };

    if (React.isValidElement(variantIcon[variant])) {
        return (
            <div {...rest} className={clsx(styles["logo"], styles[size], styles[variant], rest.className)}
                aria-label={`${variant.replace('-', ' ')} Tease Me Logo`}
                role="img"
            >
                {variantIcon[variant]}
            </div>
        );
    }
    return (
        <img
            src={variantIcon[variant] as string}
            alt={`${variant.replace('-', ' ')} Tease Me Logo`}
            {...rest}
            className={clsx(styles["logo"], styles[size], styles[variant], rest.className)}

        />
    );
};

export default TeaseMeLogo;