import React, { useRef, useEffect, useState } from 'react';
import styles from "./ProfileMedia.module.css";
import emptyProfile from "@/assets/empty-profile.png";

import foregroundFilter from "@/assets/image/avatar_filter.png";
import HeartIcon from "@/assets/Heart.svg?react";
import EditIcon from "@/assets/svg/Exclude.svg?react";

import clsx from 'clsx';
export type ProfileMediaSize = 'xsmall' | 'small' | 'medium' | 'large' | 'xlarge';

interface ProfileMediaProps extends React.HTMLAttributes<HTMLDivElement> {
    size?: ProfileMediaSize;
    active?: boolean;
    mediaType?: 'video' | 'image';
    showHearts?: boolean;
    imageSrc?: string;
    videoSrc?: string;
    altText?: string;
    onEditClick?: () => void;
    editButtonAlignment?: 'left' | 'right';
    glow?: boolean;
}

const ProfileMedia: React.FC<ProfileMediaProps> = ({
    size = 'medium',
    active = false,
    mediaType = "video",
    showHearts = false,
    imageSrc,
    videoSrc,
    altText = "Profile Image",
    onEditClick,
    editButtonAlignment = "right",
    glow = false,
    ...restProps
}) => {
    const isVideoSupported =
        typeof document !== 'undefined' &&
        document.createElement('video').canPlayType('video/mp4') !== '';
    const [shouldShowVideo, setShouldShowVideo] = useState<boolean>(
        mediaType === 'video' && isVideoSupported && !!videoSrc
    );

    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        setShouldShowVideo(mediaType === 'video' && isVideoSupported && !!videoSrc);
    }, [mediaType, isVideoSupported, videoSrc]);

    useEffect(() => {
        if (shouldShowVideo && videoRef.current) {
            videoRef.current.load();
            videoRef.current.play().catch((err) => {
                console.warn('Autoplay failed:', err);

            });
        }
    }, [shouldShowVideo]);

    const handleEditButtonClick = () => {
        onEditClick?.()
    }

    return (<div {...restProps} className={clsx(styles["profile-container"], styles[size], active && styles["active"], showHearts && styles["hearts"], glow && styles["glow"], restProps.className)} >
        <div className={styles["profile-media-container"]}>
            {shouldShowVideo ? (
                <video
                    key={videoSrc}
                    autoPlay
                    loop
                    muted
                    playsInline
                    ref={videoRef}
                    className={styles["profile-media"]}
                    onError={() => setShouldShowVideo(false)}
                >
                    <source src={videoSrc} type="video/mp4" />
                    Your browser doesn't support video.{" "}
                    <img
                        src={imageSrc ?? emptyProfile}
                        alt={altText}
                        className={styles["profile-media"]}
                    />
                </video>
            ) : (
                <img
                    src={imageSrc ?? emptyProfile}
                    alt="Profile"
                    className={styles["profile-media"]}
                />
            )}
            {imageSrc && <img
                src={foregroundFilter}
                alt="Profile"
                className={styles["profile-media-filter"]}
            />}
            <div className={styles["profile-media-placeholder"]}></div>
            {onEditClick && <div className={clsx(styles["edit-button"], styles[editButtonAlignment])} onClick={handleEditButtonClick}><EditIcon /></div>}
        </div>
        {
            showHearts && <div className={styles["hearts-overlay"]}>
                <HeartIcon
                    className={styles["heart-image"]}
                />
                <HeartIcon
                    className={styles["heart-image"]}
                />
                <HeartIcon
                    className={styles["heart-image"]}
                />
                <HeartIcon
                    className={styles["heart-image"]}
                />
            </div>
        }
    </div >);
};

export default ProfileMedia;
