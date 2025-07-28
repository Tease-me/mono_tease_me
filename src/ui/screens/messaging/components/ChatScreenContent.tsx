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
import { GetChatHistory, GetChatId } from '@/api/apis';
import { InfluencerDataModel } from '@/data/models/InfluencerDataModel';
import { Message } from '@/data/models/MessageDataModel';
import { contacts } from '@/data/mock/contacts';
import { storage } from '@/utils/storage';
import { LocalStorageKeys } from '@/constants/localStorageKeys';
import { sortAndMapMessages } from '@/api/maps/chat_maps';
import LoadingSpinner from '@/ui/components/loading/LoadingSpinner';
import clsx from 'clsx';

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

    const [messages, setMessages] = useState<Message[] | undefined>();
    const [inputText, setInputText] = useState("");
    const [inputAudio, setInputAudio] = useState<Blob>();
    const [typing, setTyping] = useState(false);
    const [isWsConnected, setIsWsConnected] = useState(false);

    const [pageNumber, setPageNumber] = useState<number>(1);

    const [hasMore, setHasMore] = useState<boolean>(true);
    const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const ws = useRef<WebSocket | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const { user } = useContext(AuthContext);
    const { user_id } = useParams();

    const navigate = useNavigate();
    const pageSize = 20;

    useEffect(() => {
        if (!id) {
            if (!user_id) {
                setInfluencer(undefined);
                return;
            }
            const localUser = contacts.find((c) => c.id === user_id);
            setInfluencer(localUser);
            setMessages(undefined);
        } else {
            const localUser = contacts.find((c) => c.id === id);
            setInfluencer(localUser);
            setMessages(undefined);
        }
    }, [id, user_id]);

    const fetchMessages = async (chat_id: string, page: number) => {
        try {
            const response = await GetChatHistory(chat_id, page, pageSize);
            const responseMessages = sortAndMapMessages(response.messages) || [];
            const totalPages = response.total / pageSize;
            if (page === 1) {
                setMessages(responseMessages);
            } else {
                setMessages(prev => prev ? [...responseMessages, ...prev] : responseMessages);
            }
            if (pageSize < totalPages) {
                setHasMore(false);
            }
        } catch (err) {
            console.error('Error loading messages', err);
        }
    };

    useEffect(() => {
        (async () => {
            if (influencer && user) {
                const response = await GetChatId(user.id, influencer.id)
                setChatId(response.chat_id);
                setPageNumber(1);
                setHasMore(true);
                fetchMessages(response.chat_id, 1);
                connectChat(influencer.id);
            }
        })()
    }, [influencer, user]);

    useEffect(() => {
        if (pageNumber === 1) {
            scrollToBottom();
        }
    }, [messages])

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    function connectChat(influencerId: string) {
        const access_token = storage.get(LocalStorageKeys.AccessToken);
        ws.current = new window.WebSocket(`${WsEndpoints.CHAT}/${influencerId}?token=${access_token}`);
        ws.current.onopen = () => setIsWsConnected(true);
        ws.current.onclose = () => setIsWsConnected(false);
        ws.current.onerror = () => setIsWsConnected(false);
        ws.current.onmessage = (event) => {
            const data = JSON.parse(event.data);
            setMessages(prev => {
                if (!prev) return
                return [
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
                ]
            });
            setTyping(prev => !prev || false);
            scrollToBottom()
        };
    }

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
        setMessages((prev) => {
            if (!prev) return;
            return [
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
            ]
        });
        scrollToBottom();
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
            setMessages(prev => {
                if (!prev) return;
                return [
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
                ]
            });

            setInputText("");
        } else if (inputAudio) {
            sendAndPlay(inputAudio);
            setMessages(prev => {
                if (!prev) return
                return [
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
                ]
            });
        }
        setInputAudio(undefined);
        setInputText('');
        scrollToBottom();
    };

    const onCall = () => {
        navigate("/voice")
    }

    const handleOnBackClick = () => {
        onBackPressed?.();
    };

    const handleScroll = async (e: React.UIEvent<HTMLDivElement>) => {
        const container = containerRef.current;
        if (container && container.scrollTop === 0 && hasMore && !isLoadingMore && chatId) {
            setIsLoadingMore(true);
            const previousScrollHeight = container.scrollHeight;
            await fetchMessages(chatId, pageNumber + 1);
            setPageNumber(prev => prev + 1);
            requestAnimationFrame(() => {
                if (containerRef.current) {
                    const newScrollHeight = containerRef.current.scrollHeight;
                    containerRef.current.scrollTop = newScrollHeight - previousScrollHeight;
                }
            });
            setIsLoadingMore(false);
        }
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

            <div
                className={clsx(styles["chat-messages-container"], !messages && styles["loading"])}
                ref={containerRef}
                onScroll={handleScroll}
            >
                {(messages) ? <>
                    {isLoadingMore && <LoadingSpinner size='small' />}
                    <MessagesList messages={messages} typing={typing} messagesEndRef={messagesEndRef} />
                </> : <LoadingSpinner />}
            </div>

            <div className={styles["chat-input-area"]}>
                <ChatInputArea
                    onSendMessage={sendMessage}
                    inputText={inputText}
                    setInputText={setInputText}
                    setInputAudio={setInputAudio}
                    disabled={messages ? false : true}
                    inputAudio={inputAudio} />
            </div>
        </div>
    );
};

export default ChatScreenContent;