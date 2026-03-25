import React, { ChangeEventHandler, useId, useState } from "react";
import clsx from "clsx";
import {
  ArrowsPointingInIcon,
  ArrowsPointingOutIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { Modal } from "@/ui/components/modals/Modal";
import styles from "./MaximizableTextEditor.module.css";

type MaximizableTextEditorProps = {
  label?: string;
  value: string;
  onChange: ChangeEventHandler<HTMLTextAreaElement>;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
  inlineExpandedRows?: number;
  modalTitle?: string;
  helperText?: string;
  className?: string;
};

const MaximizableTextEditor: React.FC<MaximizableTextEditorProps> = ({
  label,
  value,
  onChange,
  placeholder,
  disabled = false,
  rows = 10,
  inlineExpandedRows = 20,
  modalTitle,
  helperText,
  className,
}) => {
  const textareaId = useId();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const resolvedModalTitle = modalTitle || label || "Edit text";

  return (
    <>
      <div className={clsx(styles["root"], className)}>
        <div className={styles["toolbar"]}>
          {label ? (
            <label htmlFor={textareaId} className={styles["label"]}>
              {label}
            </label>
          ) : (
            <span />
          )}
          <div className={styles["actions"]}>
            <button
              type="button"
              className={styles["icon-button"]}
              onClick={() => setIsExpanded((prev) => !prev)}
              disabled={disabled}
              aria-label={isExpanded ? "Collapse prompt editor" : "Expand prompt editor"}
              title={isExpanded ? "Collapse prompt editor" : "Expand prompt editor"}
            >
              {isExpanded ? (
                <ChevronUpIcon className={styles["icon"]} aria-hidden="true" />
              ) : (
                <ChevronDownIcon className={styles["icon"]} aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              className={styles["icon-button"]}
              onClick={() => setIsModalOpen(true)}
              disabled={disabled}
              aria-label="Maximize prompt editor"
              title="Maximize prompt editor"
            >
              <ArrowsPointingOutIcon className={styles["icon"]} aria-hidden="true" />
            </button>
          </div>
        </div>

        <textarea
          id={textareaId}
          className={styles["textarea"]}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          rows={isExpanded ? inlineExpandedRows : rows}
        />

        {helperText && <div className={styles["helper"]}>{helperText}</div>}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        size="xl"
        ariaLabel={resolvedModalTitle}
        className={styles["modal"]}
      >
        <div className={styles["modal-header"]}>
          <div>
            <div className={styles["modal-title"]}>{resolvedModalTitle}</div>
            {helperText && <div className={styles["modal-helper"]}>{helperText}</div>}
          </div>
          <button
            type="button"
            className={styles["icon-button"]}
            onClick={() => setIsModalOpen(false)}
            aria-label="Close maximized prompt editor"
            title="Close maximized prompt editor"
          >
            <XMarkIcon className={styles["icon"]} aria-hidden="true" />
          </button>
        </div>

        <div className={styles["modal-toolbar"]}>
          <button
            type="button"
            className={styles["icon-button"]}
            onClick={() => setIsModalOpen(false)}
            disabled={disabled}
            aria-label="Return to inline prompt editor"
            title="Return to inline prompt editor"
          >
            <ArrowsPointingInIcon className={styles["icon"]} aria-hidden="true" />
          </button>
        </div>

        <textarea
          className={clsx(styles["textarea"], styles["textarea--modal"])}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          rows={24}
          autoFocus
        />
      </Modal>
    </>
  );
};

export default MaximizableTextEditor;
