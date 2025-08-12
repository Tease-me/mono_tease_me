import React, { useEffect, useRef, useState } from "react";

import ProfileMedia from "@/ui/components/ProfileMedia";
import CircularIconButton from "@/ui/components/inputs/buttons/CircularIconButton";
import { storage } from "@/utils/storage";
import { LocalStorageKeys } from "@/constants/localStorageKeys";
import TeaseMeLogo from "@/ui/components/logos/TeaseMeLogo";
import CallIcon from "@/assets/Call.svg?react";
import DropCallIcon from "@/assets/svg/DropCall.svg?react";
import useCall from "@/hooks/useCall";
import { Modal } from "../Modal";
import { InfluencerDataModel } from "@/data/models/InfluencerDataModel";
import { InfluencerRepo } from "@/data/repositories/InfluencerRepo";
import BlockingLoader from "../../loading/BlockingLoader";

import styles from "./WelcomeCallModal.module.css";

interface WelcomeCallModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const WelcomeCallModal: React.FC<WelcomeCallModalProps> = ({ isOpen, onClose }) => {
    const { status, startConversation, stopConversation, setInfluencerId } = useCall();
    const [influencer, setInfluencer] = useState<InfluencerDataModel>();
    const influencerRepo = InfluencerRepo();

    const audioRef = useRef(new Audio("/audio/ringtone.wav"));

    useEffect(() => {
        (async () => {
            const localInfluencers = await influencerRepo.getInfluencers();
            if (localInfluencers.length > 0) {
                const randomIndex = Math.floor(Math.random() * localInfluencers.length);
                const randomInfluencer = localInfluencers[randomIndex];
                setInfluencer(randomInfluencer);
                if (isOpen) {
                    audioRef.current.loop = true
                    audioRef.current.play();
                }
            }
        })();
    }, [])

    useEffect(() => {
        if (status === "connected") {
            storage.setBoolean(LocalStorageKeys.VisitedWelcome, true);
        } else if (status === "disconnected") {

        }
    }, [status])

    useEffect(() => {
        setInfluencerId(influencer?.id);
    }, [influencer])

    const handlePickUpCall = () => {
        audioRef.current.pause();
        startConversation();
    }

    const handleHangUpCall = () => {
        audioRef.current.pause();
        stopConversation();
        onClose();
    }
    if (!influencer) return <BlockingLoader />
    return (
        <Modal isOpen={isOpen} onClose={onClose} size="full" ariaLabel="Welcome Call">
            <div className={styles["modal-content"]}>
                {influencer && (
                    <>
                        <ProfileMedia className={styles["profile-container"]} imageSrc={influencer.img} videoSrc={influencer.videoUrl} showHearts active size="xlarge" mediaType="video" />
                        <h2 className={styles["join-text"]}>Join {influencer.name} on</h2>
                    </>
                )}

                <TeaseMeLogo size="xlarge" />

                {<>{status === "idle" ? <div className={styles["status"]}>{`${influencer?.name} is calling...`}</div> : <div className={styles["status"]}>{status}</div>}
                    <div className={styles["call-buttons"]}>
                        <CircularIconButton icon={<DropCallIcon />} onClick={handleHangUpCall} size="small" variant="tertiary" />
                        {status === "idle" && <CircularIconButton icon={<CallIcon />} onClick={handlePickUpCall} size="small" />}
                    </div>
                </>}
            </div>
        </Modal>
    );
};

export default WelcomeCallModal;