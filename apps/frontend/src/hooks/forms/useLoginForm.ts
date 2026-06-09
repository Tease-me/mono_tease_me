import { useCallback, useState } from "react";
import { validationRules } from "@/utils/validationRules";
import { validateFields } from "@/utils/validations";

type LoginErrors = {
    email?: string;
    password?: string;
    general?: string;
};

type UseLoginFormParams = {
    onSubmit: (email: string, password: string) => Promise<boolean>;
};

type UseLoginFormReturn = {
    email: string;
    password: string;
    rememberMe: boolean;
    errors: LoginErrors;
    setEmail: (value: string) => void;
    setPassword: (value: string) => void;
    onEmailBlur: () => void;
    onPasswordBlur: () => void;
    toggleRememberMe: () => void;
    submit: () => Promise<boolean>;
};

export function useLoginForm({ onSubmit }: UseLoginFormParams): UseLoginFormReturn {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [rememberMe, setRememberMe] = useState(false);
    const [errors, setErrors] = useState<LoginErrors>({});
    const [touched, setTouched] = useState({ email: false, password: false });

    const validate = useCallback((): LoginErrors => {
        return validateFields(
            { email, password },
            {
                email: validationRules.email,
                password: validationRules.password,
            }
        );
    }, [email, password]);

    const validateEmail = useCallback((value: string): string | undefined => {
        return validationRules.email(value);
    }, []);

    const validatePassword = useCallback((value: string): string | undefined => {
        return validationRules.password(value);
    }, []);

    const submit = useCallback(async (): Promise<boolean> => {
        const nextErrors = validate();
        if (Object.keys(nextErrors).length) {
            setErrors(nextErrors);
            setTouched({ email: true, password: true });
            return false;
        }

        const success = await onSubmit(email, password);
        if (!success) {
            setErrors({ general: "Login Failed. Please check your username or password." });
        }
        return success;
    }, [email, password, onSubmit, validate]);

    const handleEmailChange = useCallback((value: string) => {
        setEmail(value);
        setErrors((prev) => {
            if (!touched.email) {
                return { ...prev, general: undefined };
            }
            return { ...prev, email: validateEmail(value), general: undefined };
        });
    }, [touched.email, validateEmail]);

    const handlePasswordChange = useCallback((value: string) => {
        setPassword(value);
        setErrors((prev) => {
            if (!touched.password) {
                return { ...prev, general: undefined };
            }
            return { ...prev, password: validatePassword(value), general: undefined };
        });
    }, [touched.password, validatePassword]);

    const handleEmailBlur = useCallback(() => {
        setTouched((prev) => ({ ...prev, email: true }));
        setErrors((prev) => ({ ...prev, email: validateEmail(email), general: undefined }));
    }, [email, validateEmail]);

    const handlePasswordBlur = useCallback(() => {
        setTouched((prev) => ({ ...prev, password: true }));
        setErrors((prev) => ({ ...prev, password: validatePassword(password), general: undefined }));
    }, [password, validatePassword]);

    return {
        email,
        password,
        rememberMe,
        errors,
        setEmail: handleEmailChange,
        setPassword: handlePasswordChange,
        onEmailBlur: handleEmailBlur,
        onPasswordBlur: handlePasswordBlur,
        toggleRememberMe: () => setRememberMe((prev) => !prev),
        submit,
    };
}
