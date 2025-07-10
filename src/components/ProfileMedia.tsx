import React from 'react';
import styles from "./ProfileMedia.module.css";

interface ProfileMediaProps {
}

const ProfileMedia: React.FC<ProfileMediaProps> = ({ }) => {
    return (
        <div className={styles["profile-media-container"]}>
            <h1>ProfileMedia</h1>
        </div>
    );
};

export default ProfileMedia;