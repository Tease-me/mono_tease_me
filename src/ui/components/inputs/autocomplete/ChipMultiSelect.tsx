import React, { useEffect, useId, useRef, useState } from 'react';
import { filterLanguages } from '@/data/languages';
import AutocompleteInput from './AutocompleteInput';
import styles from './ChipMultiSelect.module.css';

export interface ChipMultiSelectProps {
  selected: string[];
  onChange: (languages: string[]) => void;
  placeholder?: string;
}

const ChipMultiSelect: React.FC<ChipMultiSelectProps> = ({
  selected,
  onChange,
  placeholder = 'Search and add a language',
}) => {
  const id = useId();
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<string[]>([]);
  const selectedRef = useRef(selected);

  selectedRef.current = selected;

  useEffect(() => {
    setOptions(filterLanguages(query, selectedRef.current));
  }, [query, selected]);

  const addLanguage = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const exists = selected.some((l) => l.toLowerCase() === trimmed.toLowerCase());
    if (exists) return;
    onChange([...selected, trimmed]);
    setQuery('');
  };

  const removeLanguage = (name: string) => {
    onChange(selected.filter((l) => l !== name));
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.inputRow}>
        <AutocompleteInput
          id={id}
          value={query}
          onChange={setQuery}
          onSelect={addLanguage}
          options={options}
          placeholder={placeholder}
          aria-label="Languages"
        />
      </div>
      {selected.length > 0 && (
        <div className={styles.chips} role="list" aria-label="Selected languages">
          {selected.map((lang) => (
            <span key={lang} className={styles.chip} role="listitem">
              {lang}
              <button
                type="button"
                className={styles.chipRemove}
                aria-label={`Remove ${lang}`}
                onClick={() => removeLanguage(lang)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default ChipMultiSelect;
