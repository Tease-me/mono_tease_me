import React from 'react';
import styles from "./Confirmation.module.css"
import BackgroundGradient from '@/ui/templates/BackgroundGradient';
import CenteredLayout from '@/ui/templates/CenteredLayout';
import CircularIconButton from '@/ui/components/inputs/buttons/CircularIconButton';
import TeaseMeLogo from '@/ui/components/logos/TeaseMeLogo';
import { useNavigate } from 'react-router-dom';

interface ConfirmationProps {
    email: string;
}

const Confirmation: React.FC<ConfirmationProps> = ({ email }) => {
    const navigate = useNavigate();
    return (
        <BackgroundGradient>
            <CenteredLayout>
                <div className={styles.container}>
                    <TeaseMeLogo size='xlarge' />
                    <h1 className={styles.title}>Account Created Successfully!</h1>
                    <p className={styles.description}>
                        A verification email has been sent to <strong>{email}</strong>. Please check your inbox and click the link to verify your account.<br /> This verification link will expire in 10 minutes.
                    </p>
                    <div className={styles["buttons-container"]}>
                        <CircularIconButton text='Back to Login' variant='tertiary' onClick={() => { navigate("/login") }} />
                    </div>
                </div>
            </CenteredLayout>
        </BackgroundGradient >
    );
};

export default Confirmation;