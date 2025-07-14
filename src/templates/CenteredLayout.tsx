import React from 'react';
import styles from "./CenteredLayout.module.css"
import clsx from 'clsx';

interface CenteredLayoutProps extends React.HTMLAttributes<HTMLDivElement> {
}

const CenteredLayout: React.FC<CenteredLayoutProps> = ({ ...restProps }) => {
    return (
        <div className={clsx(styles["container"], restProps.className)}{...restProps}>
            <div className={styles["content"]} >
                {restProps.children}
            </div>
        </div>
    );
};

export default CenteredLayout;