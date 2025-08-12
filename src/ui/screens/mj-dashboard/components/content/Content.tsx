import React from 'react';
import styles from "./Content.module.css"

interface ContentProps {
    title?: string;
}

const Content: React.FC<ContentProps> = ({ title }) => {
    return (
        <div className={styles["container"]}>
            <h1>{title}</h1>
        </div>
    );
};

export default Content;