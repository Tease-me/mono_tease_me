import React from "react";
import styles from "./ProfilePopup.module.css";
import FullScreenPopup from "@/ui/components/modals/FullScreenPopup";

interface ProfilePopupProps {
  isOpen: boolean;
  onClose: () => void;
  influencerData?: {
    name: string;
  };
}

export default function ProfilePopup({
  isOpen,
  onClose,
  influencerData,
}: ProfilePopupProps) {
  if (!influencerData) return null;

  return (
    <FullScreenPopup isOpen={isOpen} onClose={onClose} title={influencerData.name}>
      <div className={styles.profileContent}>

      </div>
    </FullScreenPopup>
  );
}
