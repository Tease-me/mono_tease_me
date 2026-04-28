import { useState } from "react";
import { PublicAssetPaths } from "@/constants/publicAssetPaths";
import CloseIconButton from "@/ui/components/inputs/buttons/CloseIconButton";
import styles from "./AvatarPicker.module.css";

type AvatarTab = "human" | "animals";

const generatePaths = (folder: string, count: number) =>
  Array.from({ length: count }, (_, i) => PublicAssetPaths.avatarImage(folder, i + 1));

const HUMAN_AVATARS = generatePaths("human", 12);
const ANIMAL_AVATARS = generatePaths("animal", 12);

type AvatarPickerProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
};

export default function AvatarPicker({ isOpen, onClose, onSelect }: AvatarPickerProps) {
  const [activeTab, setActiveTab] = useState<AvatarTab>("human");

  const avatars = activeTab === "human" ? HUMAN_AVATARS : ANIMAL_AVATARS;

  return (
    <>
      <div
        className={`${styles.backdrop} ${isOpen ? styles.backdropVisible : styles.backdropHidden}`}
        onClick={onClose}
      />
      <div className={`${styles.sheet} ${isOpen ? styles.sheetVisible : styles.sheetHidden}`}>
        <div className={styles.header}>
          <div className={styles.headerTop}>
            <CloseIconButton onClick={onClose} />
          </div>
          <div className={styles.tabs}>
            <button
              type="button"
              className={`${styles.tab} ${activeTab === "human" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("human")}
            >
              Human
            </button>
            <button
              type="button"
              className={`${styles.tab} ${activeTab === "animals" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("animals")}
            >
              Animals
            </button>
          </div>
        </div>
        <div className={styles.grid}>
          {avatars.map((url) => (
            <button
              key={url}
              type="button"
              className={styles.avatarItem}
              onClick={() => { onSelect(url); onClose(); }}
            >
              <img src={url} alt="avatar" className={styles.avatarImage} />
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
