import React from "react";
import { Modal } from "../Modal";

interface TopUpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TopUpModal({ isOpen, onClose }: TopUpModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" ariaLabel="Top up balance">
      <div>TopUpModal</div>
    </Modal>
  );
}
