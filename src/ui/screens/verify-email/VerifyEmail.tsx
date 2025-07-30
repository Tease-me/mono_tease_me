import React, { useEffect, useState } from 'react';
import styles from "./VerifyEmail.module.css"
import { useParams, useSearchParams } from "react-router-dom";
import { apiClient } from '@/api/apis';

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

    useEffect(() => {
        if (!token) return;
        const verifyEmail = async () => {
            try {
                const response: VerifyEmailResponse = await apiClient.get(`/api/auth/verify-email/`, {
                    params: {
                        "token": token
                    }
                });
                if (!response.ok) {
                    throw new Error(`Server error: ${response.message}`);
                }
                setStatus(response.message || 'Email verified successfully!');
            } catch (err: any) {
                setError(err.message);
                setStatus('Verification failed');
            }
        };
        verifyEmail();
    }, [token]);

    return (
        <div>
            <h1>Verify Email</h1>
            <p>{status}</p>
            {error && <p className={styles.error}>Error: {error}</p>}
        </div>
    );
};

export default VerifyEmail;