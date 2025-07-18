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
import { UserDataModel } from '@/data/models/UserDataModel';
import { Contact } from '@/data/models/ContactDataModel';
import ChatTopNav from '@/ui/components/nav/ChatTopNav';

const chatId = 'abc123'; // or generate per user/session
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
    const [transcribedText, setTranscribedText] = useState("");
    const [inputAudio, setInputAudio] = useState<Blob>();
    const [typing, setTyping] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement | null>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const { accessToken } = useContext(AuthContext);
    const { paramsId } = useParams();

    useEffect(() => {
        if (!id) {
            if (!paramsId) return;
            const user = contacts.find((c) => c.conversation_id === parseInt(paramsId));
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
    }, [id]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

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
            ws.current?.send(
                JSON.stringify({
                    chat_id: chatId,
                    message: "audio",
                })
            );
            setMessages(prev => [
                ...prev,
                {
                    id: Date.now(),
                    sender: 'sent',
                    text: "audio",
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

    if (!id) return <div className={styles["empty-chat-screen"]}><TeaseMeLogo size='xlarge' variant='mono-lips-only' style={{ color: "rgba(255, 255, 255, 0.5)" }} /></div>;
    return (
        <>
            <ChatTopNav onBack={handleOnBackClick} />
            <ProfileMedia imageSrc={user?.img} mediaType="image" size="xsmall" active className={styles["chat-avatar"]} />
            <h3 className={styles["chat-user-name"]}>{user && truncateLastName(user?.name)}</h3>
            <div className={styles["chat-messages-container"]}>
                <div className={styles["messages"]}>
                    {messages.map((msg) => (
                        <MessageBubble key={msg.id} msg={msg} />
                    ))}
                    {typing && <MessageBubble />}
                    <div ref={messagesEndRef} />
                </div>
            </div>
            <ChatInputArea
                onSendMessage={sendMessage}
                inputText={inputText}
                setInputText={setInputText}
                setInputAudio={setInputAudio}
                inputAudio={inputAudio}
                setTranscribedText={setTranscribedText}
                onCall={onCall} /></>
    );
};

export default ChatScreenContent;