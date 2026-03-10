import React, { forwardRef, useMemo } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import TextInput from "./TextInput";
import styles from "./DateInput.module.css";
import SvgPack from "@/utils/SvgPack";

export type DateInputProps = {
  value?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  id?: string;
  name?: string;
  autoComplete?: string;
};

const pad = (value: number) => String(value).padStart(2, "0");

const parseIsoDate = (value: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
};

const toIsoDate = (value: Date) =>
  `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;

const DateTextInput = forwardRef<
  HTMLInputElement,
  {
    value?: string;
    onClick?: React.MouseEventHandler<HTMLInputElement>;
    onBlur?: React.FocusEventHandler<HTMLInputElement>;
    placeholder?: string;
    disabled?: boolean;
    readOnly?: boolean;
    id?: string;
    name?: string;
    autoComplete?: string;
  }
>(
  (
    {
      value,
      onClick,
      onBlur,
      placeholder,
      disabled,
      readOnly,
      id,
      name,
      autoComplete,
    },
    ref,
  ) => (
    <TextInput
      ref={ref}
      type="text"
      value={value ?? ""}
      placeholder={placeholder}
      onClick={onClick}
      onBlur={onBlur}
      rightIcon={<SvgPack.IconCalendar />}
      disabled={disabled}
      readOnly={readOnly}
      className={styles["input"]}
      id={id}
      name={name}
      autoComplete={autoComplete}
    />
  ),
);

DateTextInput.displayName = "DateTextInput";

export default function DateInput({
  value = "",
  onChange,
  onBlur,
  placeholder,
  disabled,
  readOnly,
  className,
  id,
  name,
  autoComplete,
}: DateInputProps) {
  const selected = useMemo(() => parseIsoDate(value), [value]);
  const maxDate = new Date();
  const minDate = new Date(new Date().getFullYear() - 100, 0, 1);

  return (
    <div className={`${styles["container"]} ${className ?? ""}`}>
      <DatePicker
        selected={selected}
        onChange={(nextValue: Date | null) =>
          onChange(nextValue ? toIsoDate(nextValue) : "")
        }
        onBlur={onBlur}
        placeholderText={placeholder}
        customInput={
          <DateTextInput
            placeholder={placeholder}
            disabled={disabled}
            readOnly={readOnly}
            id={id}
            name={name}
            autoComplete={autoComplete}
          />
        }
        dateFormat="dd/MM/yyyy"
        showYearDropdown
        showMonthDropdown
        dropdownMode="select"
        minDate={minDate}
        maxDate={maxDate}
        disabled={disabled}
        readOnly={readOnly}
        calendarClassName={styles["calendar"]}
        popperClassName={styles["popper"]}
        wrapperClassName={styles["wrapper"]}
      />
    </div>
  );
}
