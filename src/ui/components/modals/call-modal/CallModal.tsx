import React, { useEffect, useState } from 'react';
import styles from "./CallModal.module.css"
import { Modal } from '../Modal';
import { InfluencerDataModel } from '@/data/models/InfluencerDataModel';
import { LocalStorageKeys } from '@/constants/localStorageKeys';
import { storage } from '@/utils/storage';
import BlockingLoader from '../../loading/BlockingLoader';
import TeaseMeLogo from '../../logos/TeaseMeLogo';
import ProfileMedia from '../../ProfileMedia';
import IconButton from '../../inputs/buttons/IconButton';
import CallIcon from "@/assets/Call.svg?react";
import DropCallIcon from "@/assets/svg/DropCall.svg?react";
function formatTime(seconds: number | null): string {
    if (seconds === null || seconds < 0) return "00:00";
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
        return `${hrs.toString().padStart(2, "0")}:${mins
            .toString()
            .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins.toString().padStart(2, "0")}:${secs
        .toString()
        .padStart(2, "0")}`;
}
interface CallModalProps {
    isOpen: boolean;
    onClose: () => void;
    influencer?: InfluencerDataModel;
    status: string;
    stopConversation: () => void;
    timeRemaining: number | null;
}

const CallModal: React.FC<CallModalProps> = ({ isOpen, onClose, influencer, status, stopConversation, timeRemaining }) => {
    const [secondsLeft, setSecondsLeft] = useState<number>(timeRemaining ?? 30);
    // const formatTime = (totalSeconds: number) => {
    //     const minutes = Math.floor(totalSeconds / 60);
    //     const seconds = totalSeconds % 60;
    //     return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    // };

    useEffect(() => {
        if (status === "connected") {
            storage.setBoolean(LocalStorageKeys.VisitedWelcome, true);
        } else if (status === "disconnected") {

        }
    }, [status])

    useEffect(() => {
        let timer: number | undefined;
        if (isOpen && status === "connected") {
            setSecondsLeft(timeRemaining ?? 30);
            timer = window.setInterval(() => {
                setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
            }, 1000);
        }
        return () => {
            if (timer) window.clearInterval(timer);
        };
    }, [isOpen, status]);

    useEffect(() => {
        if (secondsLeft === 0 && isOpen && status === "connected") {
            onClose();
            stopConversation();
        }
    }, [secondsLeft, isOpen, status, onClose, stopConversation]);

    const handlePickUpCall = () => {
        setSecondsLeft(timeRemaining ?? 30);
    }

    const handleHangUpCall = () => {
        setSecondsLeft(timeRemaining ?? 30);
        stopConversation();
        onClose();
    }

    if (!influencer) return <BlockingLoader />

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="sm" ariaLabel="Welcome Call" closeOnOverlayClick={false}
            closeOnEsc={false}>
            <div className={styles["modal-content"]}>
                <TeaseMeLogo className={styles["logo"]} onClick={onClose} variant='mono-lips-only' size="small" />
                {influencer && (
                    <>
                        <ProfileMedia className={styles["profile-container"]} imageSrc={influencer.img} videoSrc={influencer.videoUrl} active size="xlarge" mediaType="video" />
                        <h2 className={styles["join-text"]}>{influencer.name}</h2>
                    </>
                )}

                {<>
                    {
                        status === "connected" ?
                            <div className={styles["status"]}><span>{formatTime(timeRemaining)}</span></div>
                            :
                            <div className={styles["status"]}>Ringing...</div>
                    }
                    <div className={styles["call-buttons"]}>
                        <IconButton leftIcon={<DropCallIcon />} onClick={handleHangUpCall} color='red' />
                        {status === "idle" && <IconButton leftIcon={<CallIcon />} onClick={handlePickUpCall} color='red' />}
                    </div>
                </>}
            </div>
        </Modal>
    );
};

export default CallModal;