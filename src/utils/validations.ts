export type Validator<T> = (value: T) => string | undefined;

export const required = (label: string): Validator<string> => (value) =>
    value.trim() ? undefined : `${label} is required`;

export const minLength = (label: string, min: number): Validator<string> => (value) =>
    value.length >= min ? undefined : `${label} must be at least ${min} characters`;

export const maxLength = (label: string, max: number): Validator<string> => (value) =>
    value.length <= max ? undefined : `${label} must be ${max} characters or fewer`;

export const emailFormat: Validator<string> = (value) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? undefined : "Email is invalid";

export const regexMatch = (label: string, pattern: RegExp, message: string): Validator<string> => (value) =>
    pattern.test(value) ? undefined : `${label} ${message}`;

export const hasUppercase = (label: string): Validator<string> =>
    regexMatch(label, /[A-Z]/, "must include an uppercase letter");

export const hasLowercase = (label: string): Validator<string> =>
    regexMatch(label, /[a-z]/, "must include a lowercase letter");

export const hasNumber = (label: string): Validator<string> =>
    regexMatch(label, /\d/, "must include a number");

export const hasSpecialChar = (label: string): Validator<string> =>
    regexMatch(label, /[^A-Za-z0-9]/, "must include a special character");

export const phoneFormat: Validator<string> = (value) =>
    /^\+?[0-9\s\-().]{7,}$/.test(value) ? undefined : "Phone number is invalid";

export const urlFormat: Validator<string> = (value) => {
    try {
        new URL(value);
        return undefined;
    } catch {
        return "URL is invalid";
    }
};

export const composeValidators = <T>(...validators: Array<Validator<T>>): Validator<T> => (value) => {
    for (const validator of validators) {
        const error = validator(value);
        if (error) return error;
    }
    return undefined;
};

export const validateFields = <T extends Record<string, string>>(
    values: T,
    rules: { [K in keyof T]?: Validator<T[K]> }
): Partial<Record<keyof T, string>> => {
    const errors: Partial<Record<keyof T, string>> = {};
    (Object.keys(values) as Array<keyof T>).forEach((key) => {
        const validator = rules[key];
        if (!validator) return;
        const error = validator(values[key]);
        if (error) errors[key] = error;
    });
    return errors;
};
