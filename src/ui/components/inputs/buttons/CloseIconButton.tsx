import { Suspense } from "react";
import clsx from "clsx";
import IconButton, { type IconButtonProps } from "./IconButton";
import SvgPack from "@/utils/SvgPack";
import styles from "./CloseIconButton.module.css";

type CloseIconButtonProps = Omit<IconButtonProps, "leftIcon" | "type" | "color">;

export default function CloseIconButton({
  className,
  ...props
}: CloseIconButtonProps) {
  return (
    <IconButton
      {...props}
      type="pill"
      color="black"
      className={clsx(styles.button, className)}
      leftIcon={
        <span className={styles.iconFrame}>
          <Suspense fallback={null}>
            <SvgPack.CloseSquare className={styles.icon} />
          </Suspense>
        </span>
      }
    />
  );
}
