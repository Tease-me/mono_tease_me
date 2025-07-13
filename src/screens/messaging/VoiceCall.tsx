import React, { useEffect, useState } from 'react';
import styles from "./VoiceCall.module.css"
import BackgroundGradient from '@/templates/BackgroundGradient';
import { createWebAgent } from '@/api/bland/bland';
import LoadingSpinner from '@/components/loading/LoadingSpinner';
import VoiceChat from './VoiceChat';

interface VoiceCallProps {
}

const VoiceCall: React.FC<VoiceCallProps> = ({ }) => {
    const [agentId, setAgentId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // useEffect(() => {
    //     const initAgent = async () => {
    //         setIsLoading(true);
    //         try {
    //             const response = await createWebAgent();
    //             if (!response.agent?.agent_id) {
    //                 throw new Error("Failed to create web agent");
    //             }
    //             setAgentId(response.agent.agent_id);
    //         } catch (err) {
    //             console.error("Agent creation error:", err);
    //             setError(err instanceof Error ? err.message : "Failed to create agent");
    //         } finally {
    //             setIsLoading(false);
    //         }
    //     };

    //     initAgent();
    // }, []);

    useEffect(() => {
        const initAgent = async () => {
            setIsLoading(true);
            try {
                setAgentId("cc915b2d-95d8-453e-b55f-1c8ab5cff33f");
            } catch (err) {
                console.error("Agent creation error:", err);
                setError(err instanceof Error ? err.message : "Failed to create agent");
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
            <BackgroundGradient />
            {isLoading ? <LoadingSpinner /> : agentId && <VoiceChat agentId={agentId} />}
        </div>
    );
};

export default VoiceCall;