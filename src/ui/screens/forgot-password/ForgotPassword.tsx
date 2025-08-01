import React, { useState } from 'react';
import styles from "./ForgotPassword.module.css"
import CircularIconButton from '@/ui/components/inputs/buttons/CircularIconButton';
import TextInput from '@/ui/components/inputs/text-inputs/TextInput';
import OnBoardingTopNav from '@/ui/components/nav/OnBoardingTopNav';
import HeadingText from '@/ui/components/typography/HeadingText';
import BackgroundGradient from '@/ui/templates/BackgroundGradient';
import { useNavigate } from 'react-router-dom';
import { AuthServices } from '@/api/services/AuthServices';
import BlockingLoader from '@/ui/components/loading/BlockingLoader';

interface ForgotPasswordProps { }

const ForgotPassword: React.FC<ForgotPasswordProps> = ({ }) => {
    const [email, setPassword] = useState("");
    const [status, setStatus] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const navigate = useNavigate();
    const authServices = AuthServices();
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true);
        if (email === "") {
            setIsLoading(false);
            setStatus("Please enter your email address.");
            return;
        }
        try {
            const data = await authServices.forgotPassword(email);
            setIsLoading(false);
            if (!data.ok) {
                throw new Error(`Server error: ${data.message}`);
            }

            setStatus("If an account with that email exists, you will receive an email with instructions to reset your password.");
            setTimeout(() => {
                navigate("/login")
            }, 5000);
        } catch (err: any) {
            setStatus("Something went wrong. Please try again later.");
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
                                onChange={e => setPassword((e.target as HTMLInputElement).value)} />
                        </div>
                        {status && <span className={styles["error"]}>{status}</span>}
                        <div className={styles["user-action-section"]}>
                            <div className={styles["auth-buttons"]}>
                                <CircularIconButton className={styles["btn-back"]} onClick={() => navigate("/")} text="Back to Login" variant="tertiary" />
                                <CircularIconButton type="submit" className={styles["btn-primary"]} text="Send Reset Link" />
                            </div>
                        </div>
                    </form>
                </div>
            </div>
            {isLoading && <BlockingLoader />}
        </BackgroundGradient>
    );
};

export default ForgotPassword;