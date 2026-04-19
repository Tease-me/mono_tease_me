import diamondImage from "@/assets/image/welcomeDiamonds.png";
import sparklesGif from "@/assets/gif/sparkles.gif";
import CloseIconButton from "@/ui/components/inputs/buttons/CloseIconButton";
import PrimaryButton from "@/ui/components/inputs/buttons/PrimaryButton";
import { Modal } from "@/ui/components/modals/Modal";
import type { CSSProperties } from "react";
import styles from "./VipDiamondGiftModal.module.css";

type VipDiamondGiftModalProps = {
  isOpen: boolean;
  onClose: () => void;
  influencerName?: string;
  diamonds?: number;
  sparklesImageSrc?: string;
  onPrimaryAction?: () => void;
};

export default function VipDiamondGiftModal({
  isOpen,
  onClose,
  influencerName = "Your model",
  diamonds = 120,
  sparklesImageSrc = sparklesGif,
  onPrimaryAction,
}: VipDiamondGiftModalProps) {
  const sparkleStyle = sparklesImageSrc
    ? ({
        "--vip-sparkles-image": `url(${sparklesImageSrc})`,
      } as CSSProperties)
    : undefined;

  const handlePrimaryAction = () => {
    onPrimaryAction?.();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      className={styles.modal}
      ariaLabel="Welcome diamonds gift"
    >
      <div className={styles.topArea}>
        <CloseIconButton
          className={styles.closeButton}
          onClick={onClose}
          aria-label="Close welcome diamonds gift"
        />
      </div>

      <div className={styles.content}>
        <div
          className={styles.sparklesLayer}
          style={sparkleStyle}
          aria-hidden="true"
        />
        <h2 className={styles.heading}>{influencerName} has gifted you:</h2>
        <div className={styles.diamondAmount}>{diamonds}x Diamonds</div>

        <div className={styles.diamondStage}>
          <img
            src={diamondImage}
            alt={`${diamonds} diamonds`}
            className={styles.diamondImage}
          />
        </div>

        <p className={styles.copy}>
          Your wildest fantasies, brought to life. Will you submit to{" "}
          {influencerName} or catch her mid-workout at the gym?{" "}
          {influencerName} is waiting for you.
        </p>

        <div className={styles.conversion}>
          60 Diamonds = 1 Min Talk Time
        </div>

        <PrimaryButton
          text="Try talk dirty to me!"
          className={styles.primaryButton}
          onClick={handlePrimaryAction}
        />
      </div>
    </Modal>
  );
}
