import React, { useState, useRef, useEffect } from 'react';
import styles from "./ProfileMedia.module.css";

import foregroundFilter from "../assets/image/avatar_filter.png";
import HeartIcon from "../assets/Heart.svg?react";
import clsx from 'clsx';

interface ProfileMediaProps extends React.HTMLAttributes<HTMLDivElement> {
    mediaType?: 'video' | 'image';
    showHearts?: boolean;
    imageSrc?: string;
    videoSrc?: string;
    altText?: string;
}

const ProfileMedia: React.FC<ProfileMediaProps> = ({ mediaType = "video", showHearts = false, imageSrc, videoSrc, altText = "Profile Image", ...restProps }) => {
    const isVideoSupported =
        typeof document !== 'undefined' &&
        document.createElement('video').canPlayType('video/mp4') !== '';
    const showVideo = mediaType === 'video' && isVideoSupported;

    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (showVideo && videoRef.current) {
            videoRef.current.play().catch((err) => {
                console.warn('Autoplay failed:', err);
            });
        }
    }, [showVideo]);

    return (<div {...restProps} className={clsx(styles["profile-container"], restProps.className)} >
        <div className={styles["profile-media-container"]}>
            {showVideo ? (
                <div className={styles["profile-background"]}>
                    <video autoPlay loop muted playsInline ref={videoRef} className={styles["profile-media"]}>
                        <source src={videoSrc} type="video/mp4" />
                        Your browser doesn't support video.{" "}
                        <img
                            src={imageSrc}
                            alt={altText}
                            className={styles["profile-media"]}
                        />
                    </video>
                </div>
            ) : (
                <img
                    src={imageSrc}
                    alt="Profile"
                    className={styles["profile-media"]}
                />
            )}
            <img
                src={foregroundFilter}
                alt="Profile"
                className={styles["profile-media-filter"]}
            />
        </div>
        {showHearts && <div className={styles["hearts-overlay"]}>
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
        </div>}
    </div>);
};

export default ProfileMedia;