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
import SvgPack from '@/utils/SvgPack';
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
    useEffect(() => {
        if (status === "connected") {
            storage.setBoolean(LocalStorageKeys.VisitedWelcome, true);
        } else if (status === "disconnected") {

        }
    }, [status])

    const [callMuted, setCallMuted] = useState<boolean>(false);
    const muteUnmuteCall = () => {


        setCallMuted(prev => {
            return !prev;
        });



    }

    const handleHangUpCall = () => {
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
                        <IconButton leftIcon={callMuted? <SvgPack.Voice /> : <SvgPack.Muted />} onClick={muteUnmuteCall} color='black' />
                        <IconButton leftIcon={<SvgPack.Call />} onClick={handleHangUpCall} color='red' />
                    </div>
                </>}
            </div>
        </Modal>
    );
};

export default CallModal;