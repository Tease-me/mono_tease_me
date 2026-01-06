import { Modal } from "@/ui/components/modals/Modal";
import React, { useEffect, useRef, useState } from "react";

import styles from './ImageCrop.module.css';


export interface ImageCropProps {
    isOpen: boolean;
    imageSrc: string;
    onClose: () => void;
}

const ImageCropModal: React.FC<ImageCropProps> = ({
    isOpen,
    imageSrc,
    onClose
}) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} className={styles.modal} >
            <div className={styles.container} >
                <div className={styles.header}>
                    <h3>Crop Image</h3>
                </div>
                <div className={styles.imageArea}>
                </div>

            </div>
        </Modal>
    )
}

export default ImageCropModal;

