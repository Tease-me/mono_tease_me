import React, { useContext, useEffect, useState } from 'react';
import styles from "./Confirmation.module.css"
import BackgroundGradient from '@/ui/templates/BackgroundGradient';
import CenteredLayout from '@/ui/templates/CenteredLayout';
import TeaseMeLogo from '@/ui/components/logos/TeaseMeLogo';
import { useLocation, useNavigate } from 'react-router-dom';
import { Endpoints } from '@/api/urls';
import { AuthContext } from '@/context/AuthContext';
import LoadingSpinner from '@/ui/components/loading/LoadingSpinner';
import OnBoardingTopNav from '@/ui/components/nav/OnBoardingTopNav';
import NormalButton from '@/ui/components/inputs/buttons/NormalButton';
import SvgPack from '@/utils/SvgPack';

interface ConfirmationProps {
}

const Confirmation: React.FC<ConfirmationProps> = () => {
    const { isSignedIn, login } = useContext(AuthContext);
    const [isLoading, setIsLoading] = useState(true);
    const { state } = useLocation();
    const [email, setEmail] = useState("");

    const navigate = useNavigate();

    useEffect(() => {
        if (isSignedIn) {
            navigate("/home");
            return;
        }
        if (!state) {
            navigate("/register");
            return
        }
        const { email, password } = state as { email: string, password: string };
        setEmail(email);
        const ws = new WebSocket(`${Endpoints.ws.notifications}?email=${encodeURIComponent(email)}`);
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === "email_verified") {
                setIsLoading(false)
                login(email, password);
                navigate("/home");
                ws.close()
            }
        };
        return () => ws.close();
    }, [isSignedIn, state])

    return (
        <BackgroundGradient>
            <OnBoardingTopNav />
            <CenteredLayout>
                <div className={styles.container}>
                    <TeaseMeLogo size='xlarge' />
                    <div className={styles["title"]}>Verify Your Email</div>
                    <p className={styles.description}>
                        We’ve sent an verification email to: <strong>{email}</strong>.<br />
                        Please check your inbox and confirm your email address.<br />
                        The verification link will expire in 10 minutes.
                    </p>
                    <div className="mail-apps">
                        <SvgPack.Mail.Outlook preserveAspectRatio="xMidYMid meet" />
                        <SvgPack.Mail.Gmail preserveAspectRatio="xMidYMid meet" />
                        <SvgPack.Mail.Mail preserveAspectRatio="xMidYMid meet" />
                        <SvgPack.Mail.Yahoo preserveAspectRatio="xMidYMid meet" />
                    </div>
                    {isLoading && (
                        <div className={styles.loading}>
                            <p className={styles.description}>Waiting for you to verify your email.</p>
                            <LoadingSpinner size='small' />
                        </div>
                    )}
                    <div className={styles["buttons-container"]}>
                        <NormalButton text='Resend Verification' onClick={() => { navigate("/login") }} />
                    </div>
                    <p>Have not received the email? [Resend email]</p>
                </div>
            </CenteredLayout>
        </BackgroundGradient >
    );
};

export default Confirmation;