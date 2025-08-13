import React, { ReactNode } from 'react';
import styles from "./DetailPane.module.css"

interface DetailPaneProps {
    title?: string;
    children: ReactNode;
}

const DetailPane: React.FC<DetailPaneProps> = ({ title, children }) => {
    return (
        <div className={styles["container"]}>
            <div className={styles["title"]}>{title}</div>
            <div className={styles["content"]}>
                {children}
            </div>
        </div>
    );
};

export default DetailPane;