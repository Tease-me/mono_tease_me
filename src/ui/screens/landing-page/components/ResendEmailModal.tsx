import React from "react";

import { Modal } from "@/ui/components/modals/Modal";
import PrimaryButton from "@/ui/components/inputs/buttons/PrimaryButton";
import SvgPack from "@/utils/SvgPack";
import "./ResendEmailModal.css";

type ResendEmailModalProps = {
  isOpen: boolean;
  email: string;
  error?: string;
  success?: string;
  onEmailChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
};

const ResendEmailModal: React.FC<ResendEmailModalProps> = ({
  isOpen,
  email,
  error,
  success,
  onEmailChange,
  onClose,
  onSubmit,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      ariaLabel="Resend link"
      className="rem-modal"
    >
      <button
        className="rem-close"
        type="button"
        onClick={onClose}
        aria-label="Close"
      >
        <SvgPack.CloseSquare />
      </button>
      <h3 className="rem-title">Resend Link</h3>
      <label className="rem-label">Email or Username</label>
      <input
        className="rem-input"
        placeholder="Email or username"
        value={email}
        onChange={(e) => onEmailChange(e.target.value)}
      />
      {error && <div className="rem-error">{error}</div>}
      {success && <div className="rem-success">{success}</div>}
      <div className="rem-action">
        <PrimaryButton
          onClick={onSubmit}
          text="Resend"
          rightIcon={<SvgPack.ArrowRight />}
        />
      </div>
    </Modal>
  );
};

export default ResendEmailModal;
