import React from 'react';
import styles from "./UsersContent.module.css"

interface UsersContentProps {
}

const UsersContent: React.FC<UsersContentProps> = ({ }) => {
    return (
        <div className={styles["users-content"]}>
            {Array.from({ length: 100 }, (_, i) => (
                <h1 key={i}>Item {i + 1}</h1>
            ))}
        </div>
    );
};

export default UsersContent;