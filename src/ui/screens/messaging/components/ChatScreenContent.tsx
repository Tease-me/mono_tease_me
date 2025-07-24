import React, { useContext, useEffect, useRef, useState } from 'react';

import { Endpoints, WsEndpoints } from "@/api/urls";
import ProfileMedia from "@/ui/components/ProfileMedia";
import { truncateLastName } from "@/utils/StringUtils";
import { AuthContext } from "@/context/AuthContext";
import styles from "./ChatScreenContent.module.css"
import { useNavigate, useParams } from 'react-router-dom';
import MessageBubble from './MessageBubble';
import ChatInputArea from './ChatInputArea';
import TeaseMeLogo from '@/ui/components/logos/TeaseMeLogo';
import ChatTopNav from '@/ui/components/nav/ChatTopNav';
import { GetChatId } from '@/api/apis';
import { InfluencerDataModel } from '@/data/models/InfluencerDataModel';
import { Message } from '@/data/models/MessageDataModel';
import { contacts } from '../../home/components/HomeScreenContent';

const MessagesList = React.memo(({ messages, typing, messagesEndRef }: { messages: any[]; typing: boolean; messagesEndRef: React.RefObject<HTMLDivElement | null>; }) => {
    return (
        <div className={styles["messages"]}>
            {messages.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} />
            ))}
            {typing && <MessageBubble />}
            <div ref={messagesEndRef} />
        </div>
    );
});

interface ChatScreenContentProps {
    id?: string;
    onBackPressed?: () => void;
}

const ChatScreenContent: React.FC<ChatScreenContentProps> = ({ id, onBackPressed }) => {
    const [influencer, setInfluencer] = useState<InfluencerDataModel>();
    const [chatId, setChatId] = useState<string | undefined>();

    const ws = useRef<WebSocket | null>(null);
    const navigate = useNavigate();

    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState("");
    const [inputAudio, setInputAudio] = useState<Blob>();
    const [typing, setTyping] = useState(false);
    const [isWsConnected, setIsWsConnected] = useState(false);

    const { user } = useContext(AuthContext);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const { accessToken } = useContext(AuthContext);
    const { user_id } = useParams();

    useEffect(() => {
        if (!id) {
            if (!user_id) {
                setInfluencer(undefined);
                return;
            }
            const user = contacts.find((c) => c.id === user_id);
            setInfluencer(user);
        } else {
            const user = contacts.find((c) => c.id === id);
            setInfluencer(user);
        }
    }, [id, user_id]);

    useEffect(() => {
        if (influencer && user) {
            GetChatId(user.id, influencer.id).then((response) => {
                setChatId(response.chat_id)
            })
            ws.current = new window.WebSocket(`${WsEndpoints.CHAT}/${influencer.id}?token=${accessToken}`);
            ws.current.onopen = () => setIsWsConnected(true);
            ws.current.onclose = () => setIsWsConnected(false);
            ws.current.onerror = () => setIsWsConnected(false);
            ws.current.onmessage = (event) => {
                const data = JSON.parse(event.data);
                setMessages(prev => [
                    ...prev,
                    {
                        id: Date.now(),
                        sender: "received",
                        text: data.reply,
                        time: new Date().toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                        }),
                    },
                ]);

                setTyping(prev => !prev || false);
            };
        }

    }, [influencer])

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    async function sendAndPlay(audioBlob: Blob) {
        if (!influencer) return;
        if (!chatId) return;

        const formData = new FormData();
        formData.append("file", audioBlob);
        formData.append("persona_id", influencer.id);
        formData.append("chat_id", chatId);
        const response = await fetch(`${Endpoints.CHAT_AUDIO}`, {
            method: "POST",
            body: formData,
        });
        if (!response.ok) {
            alert("Failed to get AI audio");
            return;
        }
        const blob = await response.blob();
        setMessages((prev) => [
            ...prev,
            {
                id: Date.now(),
                sender: "received",
                text: "audio",
                time: new Date().toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                }),
                attachments: [
                    {
                        blob: blob,
                        type: "audio",
                    },
                ],
            },
        ]);
    }

    const sendMessage = () => {
        if (!influencer) return;

        if (inputText.trim()) {
            setTyping(prev => !prev || true);
            ws.current?.send(
                JSON.stringify({
                    chat_id: chatId,
                    message: inputText.trim(),
                }),
            );
            setMessages(prev => [
                ...prev,
                {
                    id: Date.now(),
                    sender: "sent",
                    text: inputText,
                    time: new Date().toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                    }),
                },
            ]);

            setInputText("");
        } else if (inputAudio) {
            sendAndPlay(inputAudio);
            setMessages(prev => [
                ...prev,
                {
                    id: Date.now(),
                    sender: 'sent',
                    time: new Date().toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                    }),
                    attachments: [
                        {
                            blob: inputAudio,
                            type: "audio"
                        }
                    ]
                },
            ]);
        }
        setInputAudio(undefined);
        setInputText('');
    };

    const onCall = () => {
        navigate("/voice")
    }

    const handleOnBackClick = () => {
        onBackPressed?.();
    };

    if (!influencer) return <div className={styles["empty-chat-screen"]}><TeaseMeLogo size='xlarge' variant='mono-lips-only' style={{ color: "rgba(255, 255, 255, 0.5)" }} /></div>;
    return (
        <div className={styles["chat-screen-content"]}>
            <div className={styles["chat-header"]}>
                <ChatTopNav onBack={handleOnBackClick} onCallClick={onCall} />
                <div className={styles["chat-header-info"]}>
                    <ProfileMedia imageSrc={influencer?.img} mediaType="image" size="xsmall" active className={styles["chat-avatar"]} />
                    <div className={styles["chat-user-name"]}>
                        <h3>{influencer && truncateLastName(influencer?.name)}</h3>
                        <p>{isWsConnected ? "Connected" : "Not Connected"}</p>
                    </div>
                </div>
            </div>
            <div className={styles["chat-messages-container"]}>
                <MessagesList messages={messages} typing={typing} messagesEndRef={messagesEndRef} />
            </div>
            <div className={styles["chat-input-area"]}>
                <ChatInputArea
                    onSendMessage={sendMessage}
                    inputText={inputText}
                    setInputText={setInputText}
                    setInputAudio={setInputAudio}
                    inputAudio={inputAudio} />
            </div>
        </div>
    );
};

export default ChatScreenContent;