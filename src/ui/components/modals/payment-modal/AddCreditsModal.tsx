import UnifiedPopup from "@/ui/components/modals/UnifiedPopup";
import AddCreditsContent from "@/ui/screens/user-profile/Components/AddCreditsContent";
import styles from "./AddCreditsModal.module.css";

type AddCreditsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  influencerId: string;
  influencerName?: string;
  image?: string;
  video?: string;
};

export default function AddCreditsModal({
  isOpen,
  onClose,
  influencerId,
  influencerName,
  image,
  video,
}: AddCreditsModalProps) {
  return (
    <UnifiedPopup
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      className={styles.modalAddCredits}
      body={
        <AddCreditsContent
          influencerId={influencerId}
          influencerName={influencerName}
          image={image}
          video={video}
          onCancel={onClose}
        />
      }
    />
  );
}
