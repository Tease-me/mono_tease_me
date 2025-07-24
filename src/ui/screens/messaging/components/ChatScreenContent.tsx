import React, { useContext, useEffect, useRef, useState } from 'react';

import { Endpoints } from "@/api/urls";
import { contacts } from "@/data/mock/MockContacts";
import ProfileMedia from "@/ui/components/ProfileMedia";
import { truncateLastName } from "@/utils/StringUtils";
import { AuthContext } from "@/context/AuthContext";
import styles from "./ChatScreenContent.module.css"
import { useNavigate, useParams } from 'react-router-dom';
import MessageBubble from './MessageBubble';
import ChatInputArea from './ChatInputArea';
import TeaseMeLogo from '@/ui/components/logos/TeaseMeLogo';
import { Contact } from '@/data/models/ContactDataModel';
import ChatTopNav from '@/ui/components/nav/ChatTopNav';

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

const chatId = "f5ab6782-4718-4035-9d8b-c99b429a30cd"; // or generate per user/session
const personaId = 'loli'; // or "loli", "bella", etc

interface ChatScreenContentProps {
    id?: number;
    onBackPressed?: () => void;
}

const ChatScreenContent: React.FC<ChatScreenContentProps> = ({ id, onBackPressed }) => {
    const [user, setuser] = useState<Contact>();

    const ws = useRef<WebSocket | null>(null);
    const navigate = useNavigate();

    const [messages, setMessages] = useState(user?.messages || []);
    const [inputText, setInputText] = useState("");
    const [inputAudio, setInputAudio] = useState<Blob>();
    const [typing, setTyping] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const { accessToken } = useContext(AuthContext);
    const { user_id } = useParams();

    useEffect(() => {
        if (!id) {
            if (!user_id) {
                setuser(undefined);
                return;
            }
            const user = contacts.find((c) => c.conversation_id === parseInt(user_id));
            setuser(user);
        } else {
            const user = contacts.find((c) => c.conversation_id === id);
            setuser(user);
        }
        ws.current = new window.WebSocket(`${Endpoints.CHAT}/${personaId}?token=${accessToken}`);
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
    }, [id, user_id]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    async function sendAndPlay(audioBlob: Blob) {
        const formData = new FormData();
        formData.append("file", audioBlob);
        formData.append("persona_id", personaId);
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

    async function playAIResponse(audioBlob: Blob) {
        const url = URL.createObjectURL(audioBlob);
        const audio = new Audio(url);
        audio.play();
    }

    const sendMessage = () => {
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

    if (!user) return <div className={styles["empty-chat-screen"]}><TeaseMeLogo size='xlarge' variant='mono-lips-only' style={{ color: "rgba(255, 255, 255, 0.5)" }} /></div>;
    return (
        <div className={styles["chat-screen-content"]}>
            <div className={styles["chat-header"]}>
                <ChatTopNav onBack={handleOnBackClick} onCallClick={onCall} />
                <div className={styles["chat-header-info"]}>
                    <ProfileMedia imageSrc={user?.img} mediaType="image" size="xsmall" active className={styles["chat-avatar"]} />
                    <h3 className={styles["chat-user-name"]}>{user && truncateLastName(user?.name)}</h3>
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