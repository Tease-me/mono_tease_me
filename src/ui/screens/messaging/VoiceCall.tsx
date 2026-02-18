import React, { useEffect, useState } from 'react';
import styles from "./VoiceCall.module.css"
import BackgroundGradient from '@/ui/templates/BackgroundGradient';
import { updateWebAgent } from '@/api/bland/bland';
import LoadingSpinner from '@/ui/components/loading/LoadingSpinner';
import VoiceChat from './VoiceChat';
import { BLAND_AGENT_LUNA } from '@/env';
import CenteredLayout from '@/ui/templates/CenteredLayout';

interface VoiceCallProps {
}

const VoiceCall: React.FC<VoiceCallProps> = ({ }) => {
    const [agentId, setAgentId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const initAgent = async () => {
            setIsLoading(true);
            try {
                const response = await updateWebAgent(BLAND_AGENT_LUNA);
                if (!response.agent?.agent_id) {
                    throw new Error("Failed to create web agent");
                }
                setAgentId(response.agent.agent_id);
            } catch (err) {
                console.error("Agent creation error:", err);
            } finally {
                setIsLoading(false);
            }
        };
        initAgent();
    }, []);

    useEffect(() => {
        const onUnload = () => {
            if (window.opener) {
                window.opener.postMessage("call-ended", "*");
            }
        };
        window.addEventListener("unload", onUnload);

        return () => {
            window.removeEventListener("unload", onUnload);
        };
    }, []);


    return (
        <div className={styles["voice-call-container"]}>
            <BackgroundGradient>
                <CenteredLayout>
                    {isLoading ? <LoadingSpinner /> : agentId && <VoiceChat agentId={agentId} />}
                </CenteredLayout>
            </BackgroundGradient>
        </div>
    );
};

export default VoiceCall;