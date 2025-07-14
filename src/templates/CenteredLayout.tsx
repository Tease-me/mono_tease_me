import React from 'react';
import styles from "./CenteredLayout.module.css"

interface CenteredLayoutProps extends React.HTMLAttributes<HTMLDivElement> {
}

const CenteredLayout: React.FC<CenteredLayoutProps> = ({ ...restProps }) => {
    return (
        <div className={styles["container"]}>
            <div className={styles["content"]} {...restProps}>
                {restProps.children}
            </div>
        </div>
    );
};

export default CenteredLayout;