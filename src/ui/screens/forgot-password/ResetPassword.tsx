import React, { useEffect, useState } from 'react';
import styles from "./ResetPassword.module.css"
import { useNavigate, useSearchParams } from 'react-router-dom';
import BackgroundGradient from '@/ui/templates/BackgroundGradient';
import { apiClient } from '@/api/apis';
import OnBoardingTopNav from '@/ui/components/nav/OnBoardingTopNav';
import HeadingText from '@/ui/components/typography/HeadingText';
import TextInput from '@/ui/components/inputs/text-inputs/TextInput';
import logger from '@/utils/logger';
import NormalButton from '@/ui/components/inputs/buttons/NormalButton';
import PrimaryButton from '@/ui/components/inputs/buttons/PrimaryButton';
import { PATHS } from '@/routes/path';
import { Endpoints } from '@/api/urls';

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

    const navigate = useNavigate();
    useEffect(() => {
        if (!token) {
            navigate(PATHS.login)
            return;
        }
    }, [token])
    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault()

        if (password === "" || confirmPassword === "") {
            setStatus("Cannot be empty");
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
                navigate("/login")
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
                                type="password"
                                placeholder="New Password"
                                value={password}
                                onChange={e => setPassword((e.target as HTMLInputElement).value)} />
                            <TextInput
                                type="password"
                                placeholder="Confirm Password"
                                value={confirmPassword}
                                onChange={e => setConfirmPassword((e.target as HTMLInputElement).value)}
                            />
                        </div>
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