import {
  ClipboardEvent,
  KeyboardEvent,
  useMemo,
  useRef,
} from "react";
import styles from "./VipInviteCodeInput.module.css";

const CODE_LENGTH = 6;
const CODE_PATTERN = /^[A-Z0-9]$/;

type VipInviteCodeInputProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export default function VipInviteCodeInput({
  value,
  onChange,
  disabled = false,
}: VipInviteCodeInputProps) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const characters = useMemo(() => {
    const padded = value.padEnd(CODE_LENGTH, " ").slice(0, CODE_LENGTH);
    return padded.split("");
  }, [value]);

  const updateValue = (next: string) => {
    onChange(next.slice(0, CODE_LENGTH));
  };

  const focusIndex = (index: number) => {
    const input = inputRefs.current[index];
    input?.focus();
    input?.select();
  };

  const handleChange = (index: number, nextChar: string) => {
    const normalized = nextChar.toUpperCase();
    if (!normalized || !CODE_PATTERN.test(normalized)) {
      return;
    }

    const chars = value.padEnd(index, " ").split("");
    while (chars.length < CODE_LENGTH) {
      chars.push(" ");
    }
    chars[index] = normalized;
    const nextValue = chars.join("").replace(/\s+$/g, "");
    updateValue(nextValue);

    if (index < CODE_LENGTH - 1) {
      focusIndex(index + 1);
    }
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace") {
      event.preventDefault();
      const chars = value.padEnd(CODE_LENGTH, " ").split("");
      if (chars[index] && chars[index] !== " ") {
        chars[index] = " ";
        updateValue(chars.join("").replace(/\s+$/g, "").replace(/ +$/g, ""));
        return;
      }
      if (index > 0) {
        focusIndex(index - 1);
      }
      return;
    }

    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      focusIndex(index - 1);
    }
    if (event.key === "ArrowRight" && index < CODE_LENGTH - 1) {
      event.preventDefault();
      focusIndex(index + 1);
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pasted = event.clipboardData
      .getData("text")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, CODE_LENGTH);
    if (!pasted) return;
    updateValue(pasted);
    focusIndex(Math.min(pasted.length, CODE_LENGTH - 1));
  };

  return (
    <div className={styles.codeRow} aria-label="Invite code">
      {characters.map((char, index) => (
        <input
          key={index}
          ref={(element) => {
            inputRefs.current[index] = element;
          }}
          className={styles.codeCell}
          type="text"
          inputMode="text"
          autoComplete="one-time-code"
          maxLength={1}
          value={char.trim()}
          disabled={disabled}
          aria-label={`Invite code character ${index + 1}`}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={handlePaste}
          onFocus={(event) => event.target.select()}
        />
      ))}
    </div>
  );
}

export const VIP_INVITE_CODE_LENGTH = CODE_LENGTH;
