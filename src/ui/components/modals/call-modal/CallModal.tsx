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
import { formatTime } from '@/utils/time';
interface CallModalProps {
    isOpen: boolean;
    onClose: () => void;
    influencer?: InfluencerDataModel;
    status: string;
    stopConversation: () => void;
    timeRemaining: number | null;
    micMuted: boolean;
    toggleMute: () => void;
}

const CallModal: React.FC<CallModalProps> = ({ isOpen, onClose, influencer, status, stopConversation, timeRemaining, micMuted, toggleMute }) => {
    useEffect(() => {
        if (status === "connected") {
            storage.setBoolean(LocalStorageKeys.VisitedWelcome, true);
        } else if (status === "disconnected") {

        }
    }, [status])
    const [message, setMessage] = useState<string>("")

    const muteUnmuteCall = () => {
        toggleMute();
    }

    const handleHangUpCall = () => {
        stopConversation();
        onClose();
    }
    useEffect(() => {
        switch (status) {
            case "connected": setMessage(`${formatTime(timeRemaining)}`)
            case "connecting": setMessage("Ringing...")
            default: setMessage("No Network")
        }
    }, [status])

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
                    <div className={styles["status"]}>{message}</div>
                    <div className={styles["call-buttons"]}>
                        <IconButton leftIcon={micMuted ? <SvgPack.Muted /> : <SvgPack.Voice />} onClick={muteUnmuteCall} color='black' />
                        <IconButton leftIcon={<SvgPack.Call />} onClick={handleHangUpCall} color='red' />
                    </div>
                </>}
            </div>
        </Modal>
    );
};

export default CallModal;
