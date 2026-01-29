
import clsx from "clsx";
import styles from "./AddonButton.module.css";
import SvgPack from "@/utils/SvgPack";

type AddonButtonProps = {
  text: string;
  variant?: "solid" | "outline";
} & React.ButtonHTMLAttributes<HTMLButtonElement>;


export default function AddonButton({ text, variant = "solid", className, ...rest }: AddonButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      className={clsx(
        styles.addonBtn,
        variant === "outline" ? styles.addonBtnSolid : styles.addonBtnOutline,
        className
      )}
    >
      <SvgPack.PlusPurple className={styles.addonBtnIcon} />
      <span className={styles.addonBtnText}>{text}</span>
    </button>
  );
}
