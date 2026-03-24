import React from "react";
import clsx from "clsx";
import styles from "./AssetPreview.module.css";

export type AssetPreviewType = "image" | "video";
export type AssetPreviewFrame = "square" | "vertical" | "landscape";

type AssetPreviewProps = {
  label: string;
  url?: string | null;
  type: AssetPreviewType;
  emptyLabel: string;
  contentType?: string | null;
  frame?: AssetPreviewFrame;
  action?: React.ReactNode;
  className?: string;
};

const AssetPreview: React.FC<AssetPreviewProps> = ({
  label,
  url,
  type,
  emptyLabel,
  contentType,
  frame = "vertical",
  action,
  className,
}) => {
  return (
    <div className={clsx(styles["root"], className)}>
      <div className={styles["header"]}>
        <div className={styles["label"]}>{label}</div>
        {action}
      </div>
      <div className={clsx(styles["frame"], styles[`frame--${frame}`])}>
        {url ? (
          type === "video" ? (
            <video
              className={styles["video"]}
              controls
              muted
              playsInline
            >
              <source src={url} type={contentType || undefined} />
            </video>
          ) : (
            <img src={url} alt={label} className={styles["image"]} />
          )
        ) : (
          <div className={styles["empty"]}>{emptyLabel}</div>
        )}
      </div>
    </div>
  );
};

export default AssetPreview;
