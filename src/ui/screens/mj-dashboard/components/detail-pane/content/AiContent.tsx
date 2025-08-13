import React from 'react';
import styles from "./AiContent.module.css"

interface AiContentProps {
}

const AiContent: React.FC<AiContentProps> = ({ }) => {
    return (
        <div className={styles["ai-content"]}>
            <h1>AiContent</h1>
        </div>
    );
};

export default AiContent;