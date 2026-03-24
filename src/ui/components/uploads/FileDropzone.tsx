import React, { DragEvent, ReactNode, Suspense, useId, useState } from "react";
import clsx from "clsx";
import SvgPack from "@/utils/SvgPack";
import styles from "./FileDropzone.module.css";

type FileDropzoneProps = {
  title: string;
  description?: string;
  accept?: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  onFileRemove: () => void;
  browseLabel?: string;
  disabled?: boolean;
  metaText?: string;
  error?: string | null;
  icon?: ReactNode;
  className?: string;
};

const FileDropzone: React.FC<FileDropzoneProps> = ({
  title,
  description,
  accept,
  file,
  onFileChange,
  onFileRemove,
  browseLabel = "Browse",
  disabled = false,
  metaText,
  error,
  icon,
  className,
}) => {
  const inputId = useId();
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (disabled) return;
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (disabled) return;
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    if (disabled) return;
    event.preventDefault();
    setIsDragging(false);
    const nextFile = event.dataTransfer.files?.[0] ?? null;
    if (nextFile) {
      onFileChange(nextFile);
    }
  };

  return (
    <div className={clsx(styles["root"], className)}>
      <div
        className={clsx(
          styles["dropzone"],
          isDragging && styles["dropzone--dragging"],
          disabled && styles["dropzone--disabled"]
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          id={inputId}
          className={styles["native-input"]}
          type="file"
          accept={accept}
          disabled={disabled}
          onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
        />

        <div className={styles["icon"]}>
          {icon ?? (
            <Suspense fallback={null}>
              <SvgPack.Upload />
            </Suspense>
          )}
        </div>
        <div className={styles["title"]}>{title}</div>
        {description && <div className={styles["description"]}>{description}</div>}
        <div className={styles["or"]}>OR</div>
        <label htmlFor={inputId} className={styles["browse-button"]}>
          {browseLabel}
        </label>
        {metaText && <div className={styles["meta"]}>{metaText}</div>}
      </div>

      {file && (
        <div className={styles["file-row"]}>
          <div className={styles["file-copy"]}>
            <div className={styles["file-name"]}>{file.name}</div>
            <div className={styles["file-size"]}>
              {Math.max(file.size / 1024, 0.1).toFixed(1)} KB
            </div>
          </div>
          <button
            type="button"
            className={styles["remove-button"]}
            onClick={onFileRemove}
            disabled={disabled}
            aria-label={`Remove ${file.name}`}
          >
            <Suspense fallback={null}>
              <SvgPack.Delete />
            </Suspense>
          </button>
        </div>
      )}

      {error && <div className={styles["error"]}>{error}</div>}
    </div>
  );
};

export default FileDropzone;
