import React from 'react';
import styles from "./Content.module.css"

interface ContentProps {
}

const Content: React.FC<ContentProps> = ({ }) => {
    return (
        <div className={styles["container"]}>
            <h1>Content</h1>
        </div>
    );
};

export default Content;