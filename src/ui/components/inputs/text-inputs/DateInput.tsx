import React, { forwardRef, Suspense, useEffect, useMemo, useState } from "react";
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

const toDisplayDate = (value: Date) =>
  `${pad(value.getDate())}/${pad(value.getMonth() + 1)}/${value.getFullYear()}`;

const formatIsoDate = (value: string) => {
  const parsed = parseIsoDate(value);
  return parsed ? toDisplayDate(parsed) : "";
};

const parseDisplayDate = (value: string): Date | null => {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
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

const DateTextInput = forwardRef<
  HTMLInputElement,
  {
    value?: string;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
    onClick?: React.MouseEventHandler<HTMLInputElement>;
    onBlur?: React.FocusEventHandler<HTMLInputElement>;
    onFocus?: React.FocusEventHandler<HTMLInputElement>;
    onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
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
      onChange,
      onClick,
      onBlur,
      onFocus,
      onKeyDown,
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
      onChange={onChange}
      onClick={onClick}
      onBlur={onBlur}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      rightIcon={<Suspense fallback={null}><SvgPack.IconCalendar /></Suspense>}
      disabled={disabled}
      readOnly={readOnly}
      className={styles["input"]}
      id={id}
      name={name}
      autoComplete={autoComplete}
      inputMode="numeric"
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
  const isIOS = useMemo(() => {
    if (typeof navigator === "undefined") return false;

    return (
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    );
  }, []);
  const selected = useMemo(() => parseIsoDate(value), [value]);
  const maxDate = useMemo(() => {
    const nextDate = new Date();
    nextDate.setHours(0, 0, 0, 0);
    return nextDate;
  }, []);
  const minDate = useMemo(() => new Date(new Date().getFullYear() - 100, 0, 1), []);
  const [displayValue, setDisplayValue] = useState(() => formatIsoDate(value));

  useEffect(() => {
    setDisplayValue(formatIsoDate(value));
  }, [value]);

  const handleCalendarChange = (nextValue: Date | null) => {
    setDisplayValue(nextValue ? toDisplayDate(nextValue) : "");
    onChange(nextValue ? toIsoDate(nextValue) : "");
  };

  const handleRawChange = (
    event?: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>,
  ) => {
    event?.preventDefault?.();

    const nextValue =
      event?.target instanceof HTMLInputElement ? event.target.value : "";

    setDisplayValue(nextValue);

    if (!nextValue.trim()) {
      onChange("");
      return;
    }

    const parsed = parseDisplayDate(nextValue);
    if (!parsed || parsed < minDate || parsed > maxDate) {
      return;
    }

    onChange(toIsoDate(parsed));
  };

  const handleInputBlur = () => {
    const trimmedValue = displayValue.trim();

    if (!trimmedValue) {
      setDisplayValue("");
      onChange("");
      onBlur?.();
      return;
    }

    const parsed = parseDisplayDate(trimmedValue);
    if (!parsed || parsed < minDate || parsed > maxDate) {
      setDisplayValue(formatIsoDate(value));
      onBlur?.();
      return;
    }

    const nextIsoDate = toIsoDate(parsed);
    setDisplayValue(toDisplayDate(parsed));
    if (nextIsoDate !== value) {
      onChange(nextIsoDate);
    }
    onBlur?.();
  };

  if (isIOS) {
    return (
      <label className={`${styles["nativeField"]} ${className ?? ""}`}>
        <div
          className={`${styles["nativeSurface"]} ${disabled || readOnly ? styles["nativeSurfaceDisabled"] : ""}`}
        >
          <span
            aria-hidden="true"
            className={value ? styles["nativeValue"] : styles["nativePlaceholder"]}
          >
            {value ? formatIsoDate(value) : placeholder}
          </span>
          <span aria-hidden="true" className={styles["nativeIcon"]}>
            <Suspense fallback={null}>
              <SvgPack.IconCalendar />
            </Suspense>
          </span>
        </div>
        <input
          className={styles["nativeInputControl"]}
          type="date"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          disabled={disabled}
          readOnly={readOnly}
          id={id}
          name={name}
          autoComplete={autoComplete}
          min={toIsoDate(minDate)}
          max={toIsoDate(maxDate)}
          aria-label={placeholder ?? "Date"}
        />
      </label>
    );
  }

  return (
    <div className={`${styles["container"]} ${className ?? ""}`}>
      <DatePicker
        selected={selected}
        value={displayValue}
        onChange={handleCalendarChange}
        onChangeRaw={handleRawChange}
        onBlur={handleInputBlur}
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
        dropdownMode="scroll"
        scrollableYearDropdown
        yearDropdownItemNumber={100}
        fixedHeight
        minDate={minDate}
        maxDate={maxDate}
        filterDate={(date) => date >= minDate && date <= maxDate}
        disabled={disabled}
        readOnly={readOnly}
        calendarClassName={styles["calendar"]}
        popperClassName={styles["popper"]}
        wrapperClassName={styles["wrapper"]}
      />
    </div>
  );
}
