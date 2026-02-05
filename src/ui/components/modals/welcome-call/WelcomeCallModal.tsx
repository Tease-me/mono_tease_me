import React, { useEffect, useState } from "react";

import ProfileMedia from "@/ui/components/ProfileMedia";
import { storage } from "@/utils/storage";
import { LocalStorageKeys } from "@/constants/localStorageKeys";
import TeaseMeLogo from "@/ui/components/logos/TeaseMeLogo";
import DropCallIcon from "@/assets/svg/DropCall.svg?react";
import { Modal } from "../Modal";
import { InfluencerDataModel } from "@/data/models/InfluencerDataModel";

import styles from "./WelcomeCallModal.module.css";
import IconButton from "../../inputs/buttons/IconButton";
import LoadingSpinner from "../../loading/LoadingSpinner";
import { formatTime } from "@/utils/time";

interface WelcomeCallModalProps {
    isOpen: boolean;
    onClose: () => void;
    influencer?: InfluencerDataModel;
    status: string;
    stopConversation: () => void;
    initalSecondsLeft?: number;
}

const WelcomeCallModal: React.FC<WelcomeCallModalProps> = ({ isOpen, onClose, influencer, status, stopConversation, initalSecondsLeft = 120 }) => {
    const [secondsLeft, setSecondsLeft] = useState<number>(initalSecondsLeft);

    useEffect(() => {
        if (status === "connected") {
            storage.setBoolean(LocalStorageKeys.VisitedWelcome, true);
        } else if (status === "disconnected") {

        }
        else if (status === "error") {

        }
    }, [status])

    useEffect(() => {
        let timer: number | undefined;
        if (isOpen && status === "connected") {
            setSecondsLeft(initalSecondsLeft);
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

    // const handlePickUpCall = () => {
    //     setSecondsLeft(initalSecondsLeft);
    // }

    const handleHangUpCall = () => {
        setSecondsLeft(initalSecondsLeft);
        stopConversation();
        onClose();
    }

    if (isOpen && !influencer) return <LoadingSpinner />

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="sm" ariaLabel="Welcome Call">
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
                            <div className={styles["status"]}><span>{formatTime(secondsLeft)}</span></div>
                            :
                            <div className={styles["status"]}>{status}</div>
                    }
                    <div className={styles["call-buttons"]}>
                        <IconButton
                            color="red"
                            leftIcon={<DropCallIcon style={{ color: "#fff", width: 24, height: 24 }} />}
                            onClick={handleHangUpCall}
                        />

                        {/* {status === "idle" && <IconButton leftIcon={<CallIcon />} onClick={handlePickUpCall} />} */}
                    </div>
                </>}
            </div>
        </Modal>
    );
};

export default WelcomeCallModal;
