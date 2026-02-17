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
              <div className={styles.radioGroup}>
                {question.options?.map((option) => (
                  <label key={option.value}>
                    <input
                      type="radio"
                      name={question.id}
                      checked={answers[question.id] === option.value}
                      onChange={() => onAnswerChange(question.id, option.value)}
                    />
                    {option.label}
                  </label>
                ))}
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
