import React, { useCallback, useEffect, useState } from 'react';
import styles from "./VoiceCall.module.css"
import BackgroundGradient from '@/ui/templates/BackgroundGradient';
import { createWebAgent, updateWebAgent } from '@/api/bland/bland';
import LoadingSpinner from '@/ui/components/loading/LoadingSpinner';
import VoiceChat from './VoiceChat';
import { BLAND_AGENT_LUNA, BLAND_AGENT_TEST } from '@/api/env';
import CenteredLayout from '@/ui/templates/CenteredLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card';
import { useConversation } from "@11labs/react";
import { getSignedUrl } from '@/api/eleven/eleven';
import { releaseMicrophonePermission, requestMicrophonePermission } from '@/utils/Permissions';


interface VoiceCallElevenProps {
}

const VoiceCallEleven: React.FC<VoiceCallElevenProps> = ({ }) => {
    const conversation = useConversation({
        onConnect: () => {
            console.log("connected");
        },
        onDisconnect: () => {
            console.log("disconnected");
        },
        onError: error => {
            console.log(error);
            alert("An error occurred during the conversation");
        },
        onMessage: message => {
            console.log(message);
        },
    });
    async function startConversation() {
        const hasPermission = await requestMicrophonePermission();
        if (!hasPermission) {
            alert("No permission");
            return;
        }
        const signedUrl = await getSignedUrl();
        const conversationId = await conversation.startSession({ signedUrl });
        console.log(conversationId);
    }

    const stopConversation = useCallback(async () => {
        await conversation.endSession();
        releaseMicrophonePermission();
    }, [conversation]);

    return (
        <div className={"flex justify-center items-center gap-x-4"}>
            <Card className={"rounded-3xl"}>
                <CardContent>
                    <CardHeader>
                        <CardTitle className={"text-center"}>
                            {conversation.status === "connected"
                                ? conversation.isSpeaking
                                    ? `Agent is speaking`
                                    : "Agent is listening"
                                : "Disconnected"}
                        </CardTitle>
                    </CardHeader>
                    <div className={"flex flex-col gap-y-4 text-center"}>

                        <button
                            className={"rounded-full"}
                            disabled={
                                conversation !== null && conversation.status === "connected"
                            }
                            onClick={startConversation}
                        >
                            Start conversation
                        </button>
                        <button
                            className={"rounded-full"}
                            disabled={conversation === null}
                            onClick={stopConversation}
                        >
                            End conversation
                        </button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default VoiceCallEleven;