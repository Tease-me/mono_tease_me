import React, { AllHTMLAttributes, ReactNode } from 'react';
import styles from "./FullWidthLayout.module.css"
import clsx from 'clsx';

interface FullWidthLayoutProps extends AllHTMLAttributes<HTMLDivElement> {
    fullWidthNav?: ReactNode;
}

const FullWidthLayout: React.FC<FullWidthLayoutProps> = ({ fullWidthNav, ...restProps }) => {
    return (
        <div {...restProps} className={clsx(styles["container"], restProps.className)} >
            {fullWidthNav && fullWidthNav}
            <div className={styles["content"]}>
                {restProps.children}
            </div>
        </div>
    );
};

export default FullWidthLayout;