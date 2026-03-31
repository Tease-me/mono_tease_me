import React, { useEffect, useState, Suspense } from 'react';
import styles from "./ResetPassword.module.css"
import { useNavigate, useSearchParams } from 'react-router-dom';
import BackgroundGradient from '@/ui/templates/BackgroundGradient';
import { apiClient } from '@/api/apis';
import OnBoardingTopNav from '@/ui/components/nav/OnBoardingTopNav';
import HeadingText from '@/ui/components/typography/HeadingText';
import TextInput from '@/ui/components/inputs/text-inputs/TextInput';
import SvgPack from '@/utils/SvgPack';
import logger from '@/utils/logger';
import NormalButton from '@/ui/components/inputs/buttons/NormalButton';
import PrimaryButton from '@/ui/components/inputs/buttons/PrimaryButton';
import { Paths } from '@/routes/path';
import { Endpoints } from '@/api/urls';
import { validationRules } from '@/utils/validationRules';

interface ResetPasswordResponse {
    ok: boolean;
    message: string;
}

interface ResetPasswordProps {
}

const ResetPassword: React.FC<ResetPasswordProps> = ({ }) => {
    const [searchParams] = useSearchParams();

    const token = searchParams.get('token');

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [status, setStatus] = useState("");
    const [showPasswords, setShowPasswords] = useState(false);

    const navigate = useNavigate();
    useEffect(() => {
        if (!token) {
            navigate(Paths.login)
            return;
        }
    }, [token])
    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault()

        if (password === "" || confirmPassword === "") {
            setStatus("Cannot be empty");
            return;
        }
        const passwordError = validationRules.password(password);
        if (passwordError) {
            setStatus(passwordError);
            return;
        }
        if (password !== confirmPassword) {
            setStatus("Password not matching");
            return;
        }

        try {
            const { data } = await apiClient.post<ResetPasswordResponse>(Endpoints.auth.resetPassword, {
                "token": token,
                "new_password": password
            });

            if (!data.ok) {
                throw new Error(`Server error: ${data.message}`);
            }

            setStatus(data.message);
            setTimeout(() => {
                navigate(Paths.login)
            }, 5000);
        } catch (err: any) {
            logger.error(err)
            setStatus('Something went wrong please try again!');
        }
    };
    return (
        <BackgroundGradient>
            <div className={styles["reset-password-screen"]}>
                <OnBoardingTopNav />
                <div className={styles["content"]}>
                    <HeadingText className={styles["title"]}>Reset your Password</HeadingText>
                    <form className={styles["auth-form"]} onSubmit={handleSubmit}>
                        <div className={styles["input-fields"]}>
                            <TextInput
                                type={showPasswords ? "text" : "password"}
                                placeholder="New Password"
                                value={password}
                                rightIcon={
                                  <button
                                    type="button"
                                    className={styles["eye-button"]}
                                    onClick={() => setShowPasswords((v) => !v)}
                                    tabIndex={-1}
                                  >
                                    <Suspense fallback={null}>
                                      {showPasswords ? <SvgPack.EyeOff /> : <SvgPack.Eye />}
                                    </Suspense>
                                  </button>
                                }
                                onChange={e => setPassword((e.target as HTMLInputElement).value)} />
                            <TextInput
                                type={showPasswords ? "text" : "password"}
                                placeholder="Confirm Password"
                                value={confirmPassword}
                                rightIcon={
                                  <button
                                    type="button"
                                    className={styles["eye-button"]}
                                    onClick={() => setShowPasswords((v) => !v)}
                                    tabIndex={-1}
                                  >
                                    <Suspense fallback={null}>
                                      {showPasswords ? <SvgPack.EyeOff /> : <SvgPack.Eye />}
                                    </Suspense>
                                  </button>
                                }
                                onChange={e => setConfirmPassword((e.target as HTMLInputElement).value)}
                            />
                        </div>
                        {password.length > 0 && confirmPassword.length > 0 && password === confirmPassword && (
                            <span className={styles["success"]}>Passwords match</span>
                        )}
                        {status && <span className={styles["error"]}>{status}</span>}
                        <div className={styles["user-action-section"]}>
                            <div className={styles["auth-buttons"]}>
                                <NormalButton className={styles["btn-back"]} onClick={() => navigate(-1)} text="Back" color='black' />
                                <PrimaryButton className={styles["btn-primary"]} text="Continue" onClick={() => handleSubmit()} />
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </BackgroundGradient>
    );
};

export default ResetPassword;
