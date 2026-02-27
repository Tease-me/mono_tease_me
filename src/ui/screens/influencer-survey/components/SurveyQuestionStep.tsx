// Survey Question Step Component
// Renders survey questions with proper validation

import React from 'react';
import { SurveyStep, SurveyQuestion } from '../validation/surveyValidation';
import styles from '../ProfileSurvey.module.css';

interface SurveyQuestionStepProps {
  step: SurveyStep;
  answers: Record<string, any>;
  errors: Record<string, string>;
  onAnswerChange: (key: string, value: any) => void;
}

const renderOptionLabel = (label: string) => {
  if (label.includes(' - ')) {
    const [title, ...descParts] = label.split(' - ');
    const description = descParts.join(' - ');
    return (
      <div className={styles.optionLabelContainer}>
        <span className={styles.optionTitle}>{title}</span>
        <span className={styles.optionDescription}>{description}</span>
      </div>
    );
  }
  return <span className={styles.optionTitle}>{label}</span>;
};

const SurveyQuestionStep: React.FC<SurveyQuestionStepProps> = ({
  step,
  answers,
  errors,
  onAnswerChange,
}) => {
  return (
    <div className={styles.content}>
      {step.questions.map((question: SurveyQuestion) => {
        if (question.type === 'text' || question.type === 'textarea') {
          const InputTag: React.ElementType = question.type === 'textarea' ? 'textarea' : 'input';

          return (
            <div key={question.id} className={styles.field}>
              <label className={styles.label}>
                {question.label}{' '}
                {question.required && <span className={styles.required}>*</span>}
              </label>
              <InputTag
                className={styles.input}
                value={answers[question.id] || ''}
                placeholder={question.placeholder}
                onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                  onAnswerChange(question.id, e.target.value)
                }
              />
              {errors[question.id] && <div className={styles.error}>{errors[question.id]}</div>}
            </div>
          );
        }

        if (question.type === 'radio') {
          return (
            <div key={question.id} className={styles.field}>
              <label className={styles.label}>
                {question.label}{' '}
                {question.required && <span className={styles.required}>*</span>}
              </label>
              <div className={styles.optionsGrid}>
                {question.options?.map((option) => {
                  const isChecked = answers[question.id] === option.value;
                  return (
                    <label
                      key={option.value}
                      className={`${styles.optionCard} ${isChecked ? styles.optionCardSelected : ''}`}
                    >
                      <input
                        type="radio"
                        name={question.id}
                        checked={isChecked}
                        onChange={() => onAnswerChange(question.id, option.value)}
                        className={styles.hiddenInput}
                      />
                      {renderOptionLabel(option.label)}
                    </label>
                  );
                })}
              </div>
              {errors[question.id] && <div className={styles.error}>{errors[question.id]}</div>}
            </div>
          );
        }

        if (question.type === 'checkbox') {
          const currentAnswers = answers[question.id] || [];
          const selectedArray = Array.isArray(currentAnswers) ? currentAnswers : [];

          const handleCheckboxChange = (optionValue: string | number, checked: boolean) => {
            if (checked) {
              onAnswerChange(question.id, [...selectedArray, optionValue]);
            } else {
              onAnswerChange(question.id, selectedArray.filter((v: any) => v !== optionValue));
            }
          };

          const boundsText = question.min && question.max
            ? `(Choose ${question.min}-${question.max})`
            : question.max ? `(Up to ${question.max})`
              : question.min ? `(At least ${question.min})`
                : '';

          return (
            <div key={question.id} className={styles.field}>
              <label className={styles.label}>
                {question.label} {boundsText && <span className={styles.boundsHint}>{boundsText}</span>}
                {question.required && <span className={styles.required}>*</span>}
              </label>
              <div className={styles.optionsGrid}>
                {question.options?.map((option) => {
                  const isChecked = selectedArray.includes(option.value);
                  const isMaxReached = question.max ? selectedArray.length >= question.max : false;
                  const isDisabled = !isChecked && isMaxReached;

                  return (
                    <label
                      key={option.value}
                      className={`${styles.optionCard} ${isChecked ? styles.optionCardSelected : ''} ${isDisabled ? styles.optionCardDisabled : ''}`}
                    >
                      <input
                        type="checkbox"
                        name={question.id}
                        checked={isChecked}
                        disabled={isDisabled}
                        onChange={(e) => handleCheckboxChange(option.value, e.target.checked)}
                        className={styles.hiddenInput}
                      />
                      {renderOptionLabel(option.label)}
                    </label>
                  );
                })}
              </div>
              {errors[question.id] && <div className={styles.error}>{errors[question.id]}</div>}
            </div>
          );
        }

        return null;
      })}
    </div>
  );
};

export default SurveyQuestionStep;
