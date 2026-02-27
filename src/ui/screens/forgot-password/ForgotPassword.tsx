import React, { useState } from 'react';
import styles from "./ForgotPassword.module.css"
import TextInput from '@/ui/components/inputs/text-inputs/TextInput';
import OnBoardingTopNav from '@/ui/components/nav/OnBoardingTopNav';
import HeadingText from '@/ui/components/typography/HeadingText';
import BackgroundGradient from '@/ui/templates/BackgroundGradient';
import { useNavigate } from 'react-router-dom';
import { AuthServices } from '@/api/services/AuthServices';
import BlockingLoader from '@/ui/components/loading/BlockingLoader';
import { apiClient } from '@/api/apis';
import ButtonRow from '@/ui/templates/ButtonRow';
import logger from '@/utils/logger';
import NormalButton from '@/ui/components/inputs/buttons/NormalButton';
import PrimaryButton from '@/ui/components/inputs/buttons/PrimaryButton';
import { Paths } from '@/routes/path';

interface ForgotPasswordProps { }

const ForgotPassword: React.FC<ForgotPasswordProps> = ({ }) => {
    const [email, setEmail] = useState("");
    const [status, setStatus] = useState("");
    const [isSuccess, setIsSuccess] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const navigate = useNavigate();
    const authServices = AuthServices(apiClient);
    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault()

        if (isLoading) return;

        if (email === "") {
            setStatus("Please enter your email address.");
            setIsSuccess(false);
            return;
        }

        setIsLoading(true);
        try {
            const data = await authServices.forgotPassword(email);
            if (!data.ok) {
                throw new Error(`Server error: ${data.message}`);
            }

            setStatus("If an account with that email exists, you will receive an email with instructions to reset your password.");
            setIsSuccess(true);
            setTimeout(() => {
                navigate(Paths.login)
            }, 5000);
        } catch (err: any) {
            logger.error(err);
            setStatus("Something went wrong. Please try again later.");
            setIsSuccess(false);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <BackgroundGradient>
            <div className={styles["forgot-password-screen"]}>
                <OnBoardingTopNav />
                <div className={styles["content"]}>
                    <HeadingText className={styles["title"]}>Reset your password</HeadingText>
                    <p>Enter the email address associated with your account, and we'll send you a link to reset your password.</p>
                    <form className={styles["auth-form"]} onSubmit={handleSubmit}>
                        <div className={styles["input-fields"]}>
                            <TextInput
                                type="email"
                                placeholder="Email address"
                                value={email}
                                onChange={e => setEmail((e.target as HTMLInputElement).value)} />
                        </div>
                        {status && <span className={styles[isSuccess ? "success" : "error"]}>{status}</span>}
                        <div className={styles["user-action-section"]}>
                            <ButtonRow>
                                <NormalButton className={styles["btn-back"]} onClick={() => navigate(Paths.login)} text="Back to Login" color='black' />
                                <PrimaryButton className={styles["btn-primary"]} text={isLoading ? "Sending..." : "Send Reset Link"} onClick={() => handleSubmit()} disabled={isLoading} />
                            </ButtonRow>
                        </div>
                    </form>
                </div>
            </div>
            {isLoading && <BlockingLoader />}
        </BackgroundGradient>
    );
};

export default ForgotPassword;
