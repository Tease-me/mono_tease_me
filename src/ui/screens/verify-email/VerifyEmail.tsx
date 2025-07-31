import React, { useEffect, useState } from 'react';
import styles from "./VerifyEmail.module.css"
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { apiClient } from '@/api/apis';
import BackgroundGradient from '@/ui/templates/BackgroundGradient';
import CenteredLayout from '@/ui/templates/CenteredLayout';
import TeaseMeLogo from '@/ui/components/logos/TeaseMeLogo';
import CircularIconButton from '@/ui/components/inputs/buttons/CircularIconButton';

interface VerifyEmailProps {
}

interface VerifyEmailResponse {
    ok: boolean;
    message: string;
}

const VerifyEmail: React.FC<VerifyEmailProps> = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const [status, setStatus] = useState<string>('Verifying...');
    const [error, setError] = useState<string | null>(null);

    const navigate = useNavigate();

    useEffect(() => {
        if (!token) return;
        const verifyEmail = async () => {
            try {
                const { data } = await apiClient.get<VerifyEmailResponse>(`/auth/verify-email/`, {
                    params: { token }
                });
                if (!data.ok) {
                    throw new Error(`Server error: ${data.message}`);
                }
                setStatus(data.message);
                setTimeout(() => {
                    window.close();
                }, 5000);
            } catch (err: any) {
                setError(err.message);
                setStatus('Verification failed');
            }
        };
        verifyEmail();
    }, [token]);

    return (
        <BackgroundGradient>
            <CenteredLayout>
                <div className={styles.container}>
                    <TeaseMeLogo size='xlarge' />
                    <h1 className={styles.title}>Verify Email</h1>
                    <p className={styles.description}>
                        {status}
                    </p>
                    {error && <p className={styles.error}>Error: {error}</p>}
                    <div className={styles["buttons-container"]}>
                        <CircularIconButton text='Back to Login' variant='tertiary' onClick={() => { navigate("/login") }} />
                    </div>
                </div>
            </CenteredLayout>
        </BackgroundGradient >
    );
};

export default VerifyEmail;