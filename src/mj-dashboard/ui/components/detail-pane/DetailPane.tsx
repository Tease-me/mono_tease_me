import React, { ReactNode } from 'react';
import styles from "./DetailPane.module.css"
import clsx from 'clsx';

interface DetailPaneProps {
    title?: string;
    children: ReactNode;
    scollable?: boolean;
}

const DetailPane: React.FC<DetailPaneProps> = ({ title, children, scollable = true }) => {
    return (
        <div className={clsx(styles["container"], scollable && styles["scroll"])}>
            <div className={styles["title"]}>{title}</div>
            {children}
        </div>
    );
};

export default DetailPane;