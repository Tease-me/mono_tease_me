import { Modal } from "@/ui/components/modals/Modal";
import React, {  useState } from "react";
import Cropper, {Area} from "react-easy-crop";
import PrimaryButton from "../../inputs/buttons/PrimaryButton";
import NormalButton from "../../inputs/buttons/NormalButton";

import styles from './ImageCropModal.module.css';


export interface ImageCropProps {
    isOpen: boolean;
    imageSrc: string;
    onClose: () => void;
    onCropComplete: (blob: Blob, dataUrl: string) => void;
}

const ImageCropModal: React.FC<ImageCropProps> = ({
    isOpen,
    imageSrc,
    onClose,
    onCropComplete
}) => {



    const [crop, setCrop] = useState<{ x: number, y: number }>({ x: 0, y: 0 });
    const [zoom,setZoom] = useState<number>(1);
      const [area, setArea] = useState<Area | null>(null);

function handleCrop() {
  if (!area) return;
  const canvas = document.createElement("canvas");
  canvas.width = area.width;
  canvas.height = area.height;
  const ctx = canvas.getContext("2d");
  const image = new Image();
  image.onload = () => {
    if (!ctx) return;
    ctx.drawImage(
      image,
      area.x, area.y, area.width, area.height,
      0, 0, area.width, area.height
    );
    canvas.toBlob((blob) => {
      if (!blob) return;
      const dataUrl = canvas.toDataURL("image/jpeg");
      onCropComplete(blob, dataUrl );
      onClose();
    }, "image/jpeg");
  };
  image.src = imageSrc;
}




    return (
        <Modal isOpen={isOpen} onClose={onClose} className={styles.modal} ariaLabel="Crop Image" >
            <div className={styles.container} >
                <div className={styles.header}>
                    <h3>Crop Image</h3>
                </div>
                <div className={styles.imageArea}>
                    <Cropper
                        image={imageSrc}
                        crop={crop}
                        zoom={zoom}
                        aspect={1 / 1}
                        onCropChange={setCrop}
                        onZoomChange={setZoom}
                        onCropComplete= {(_, a) => setArea(a)}
                    />
                </div>
                <div className={styles.btnArea}>
                    <NormalButton onClick={onClose} text="Cancel" />
                    <PrimaryButton onClick={handleCrop} text="Crop"/>

                </div>

            </div>
        </Modal>
    )
}

export default ImageCropModal;

