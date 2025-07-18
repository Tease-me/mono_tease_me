import React, { AllHTMLAttributes } from 'react';
import styles from "./FullWidthLayout.module.css"
import clsx from 'clsx';

interface FullWidthLayoutProps extends AllHTMLAttributes<HTMLDivElement> {
}

const FullWidthLayout: React.FC<FullWidthLayoutProps> = ({ ...restProps }) => {
    return (
        <div {...restProps} className={clsx(styles["container"], restProps.className)} >
            <div className={styles["content"]}>
                {restProps.children}
            </div>
        </div>
    );
};

export default FullWidthLayout;