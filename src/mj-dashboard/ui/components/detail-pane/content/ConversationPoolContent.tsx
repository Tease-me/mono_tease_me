import React from 'react';
import styles from "./ConversationPoolContent.module.css"

interface ConversationPoolContentProps {
}

const ConversationPoolContent: React.FC<ConversationPoolContentProps> = ({ }) => {
    return (
        <div className={styles["conversation-pool-content"]}>
            <h1>ConversationPoolContent</h1>
        </div>
    );
};

export default ConversationPoolContent;