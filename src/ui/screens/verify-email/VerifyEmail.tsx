import React, { useContext, useEffect, useRef, useState } from 'react';
import styles from "./VerifyEmail.module.css"
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiClient } from '@/api/apis';
import { VerifyEmailResponse } from '@/api/models/auth';
import BackgroundGradient from '@/ui/templates/BackgroundGradient';
import CenteredLayout from '@/ui/templates/CenteredLayout';
import NormalButton from '@/ui/components/inputs/buttons/NormalButton';
import { Endpoints } from '@/api/urls';
import { Paths } from '@/routes/path';
import { AuthContext } from '@/context/AuthContext';

const VerifyEmail: React.FC = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const [status, setStatus] = useState<string>('Verifying...');
    const [error, setError] = useState<string | null>(null);
    const [isExpired, setIsExpired] = useState(false);
    const [resendEmail, setResendEmail] = useState('');
    const [isResending, setIsResending] = useState(false);
    const [resendMessage, setResendMessage] = useState<string | null>(null);
    const hasAttemptedVerification = useRef(false);

    const navigate = useNavigate();
    const { loginWithTokens } = useContext(AuthContext);

    useEffect(() => {
        if (!token) {
            navigate(Paths.root)
            return
        }
        if (hasAttemptedVerification.current) {
            return;
        }
        hasAttemptedVerification.current = true;
        const verifyEmail = async () => {
            try {
                const { data } = await apiClient.get<VerifyEmailResponse>(Endpoints.auth.confirmEmail, {
                    params: { token }
                });
                if (!data.ok) {
                    throw new Error(`Server error: ${data.message}`);
                }
                setStatus(data.message);
                setError(null);
                try {
                    await loginWithTokens(data.access_token, data.refresh_token);
                    navigate(Paths.home);
                } catch {
                    setError("Email verified, but automatic sign-in failed. Please log in manually.");
                }
            } catch (err: any) {
                const statusCode = err?.response?.status;
                const detail = err?.response?.data?.detail;

                if (statusCode === 410) {
                    setIsExpired(true);
                    setStatus('Verification link has expired');
                    setError(typeof detail === 'string' ? detail : 'This link has expired. Please request a new one.');
                } else {
                    setError(typeof detail === 'string' ? detail : err.message);
                    setStatus('Verification failed');
                }
            }
        };
        verifyEmail();
    }, [loginWithTokens, navigate, token]);

    const handleResend = async () => {
        if (!resendEmail.trim() || isResending) return;
        setIsResending(true);
        setResendMessage(null);
        try {
            const { data } = await apiClient.post(
                `${Endpoints.auth.resendVerificationEmail}?email=${encodeURIComponent(resendEmail.trim())}`
            );
            setResendMessage(data.message ?? "A new verification email has been sent!");
            setIsExpired(false);
            setError(null);
            setStatus("A new verification email has been sent! Check your inbox.");
        } catch (err: any) {
            const detail = err?.response?.data?.detail;
            setResendMessage(typeof detail === 'string' ? detail : "Failed to resend. Please try again later.");
        } finally {
            setIsResending(false);
        }
    };

    return (
        <BackgroundGradient>
            <CenteredLayout>
                <div className={styles.container}>
                    <h1 className={styles.title}>Verify Email</h1>
                    <p className={styles.description}>
                        {status}
                    </p>
                    {error && <p className={styles.error}>{error}</p>}

                    {isExpired && (
                        <div style={{ marginTop: 16, width: '100%', maxWidth: 360 }}>
                            <p className={styles.description} style={{ marginBottom: 8 }}>
                                Enter your email to receive a new verification link:
                            </p>
                            <input
                                type="email"
                                placeholder="Your email address"
                                value={resendEmail}
                                onChange={(e) => setResendEmail(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '12px 16px',
                                    borderRadius: 8,
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    background: 'rgba(255,255,255,0.1)',
                                    color: '#fff',
                                    fontSize: 14,
                                    outline: 'none',
                                    boxSizing: 'border-box',
                                    marginBottom: 12,
                                }}
                            />
                            <NormalButton
                                text={isResending ? "Sending..." : "Resend Verification Email"}
                                onClick={handleResend}
                            />
                            {resendMessage && (
                                <p className={styles.description} style={{ marginTop: 8 }}>
                                    {resendMessage}
                                </p>
                            )}
                        </div>
                    )}

                    <div className={styles["buttons-container"]}>
                        <NormalButton text='Back to Login' color='black' onClick={() => { navigate(Paths.login) }} />
                    </div>
                </div>
            </CenteredLayout>
        </BackgroundGradient >
    );
};

export default VerifyEmail;
