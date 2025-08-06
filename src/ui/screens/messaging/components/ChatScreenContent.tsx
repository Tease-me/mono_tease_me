import React, { useContext, useEffect, useRef, useState } from 'react';

import { Endpoints, WS_BASE_URL } from "@/api/urls";
import ProfileMedia from "@/ui/components/ProfileMedia";
import { truncateLastName } from "@/utils/StringUtils";
import { AuthContext } from "@/context/AuthContext";
import styles from "./ChatScreenContent.module.css"
import { useNavigate, useParams } from 'react-router-dom';
import MessageBubble from './MessageBubble';
import ChatInputArea from './ChatInputArea';
import TeaseMeLogo from '@/ui/components/logos/TeaseMeLogo';
import ChatTopNav from '@/ui/components/nav/ChatTopNav';
import { InfluencerDataModel } from '@/data/models/InfluencerDataModel';
import { Message, MessagePagination } from '@/data/models/MessageDataModel';
import { storage } from '@/utils/storage';
import { LocalStorageKeys } from '@/constants/localStorageKeys';
import LoadingSpinner from '@/ui/components/loading/LoadingSpinner';
import clsx from 'clsx';
import { ChatRepository } from '@/data/repositories/ChatRepo';
import { InfluencerRepo } from '@/data/repositories/InfluencerRepo';

const MessagesList = React.memo(({ messages, typing, messagesEndRef }: { messages: any[]; typing: boolean; messagesEndRef: React.RefObject<HTMLDivElement | null>; }) => {
    return (
        <>
            <div className={styles["messages"]}>
                {messages.map((msg) => (
                    <MessageBubble key={msg.id} msg={msg} />
                ))}
                {typing && <MessageBubble />}
            </div>
            <div ref={messagesEndRef} style={{ height: "50px" }} />
        </>
    );
});

interface ChatScreenContentProps {
    id?: string;
    onBackPressed?: () => void;
}
type ChatAudioResponse = {
    ai_text: string;
    ai_audio_url: string;
    user_audio_url: string;
    transcript: string;
};
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

    const chatRepository = ChatRepository();
    const influencerRepo = InfluencerRepo();

    useEffect(() => {
        (async () => {
            if (!id) {
                if (!user_id) {
                    setInfluencer(undefined);
                    return;
                }
                const localInfluencer = await influencerRepo.getInfluencer(user_id);
                setInfluencer(localInfluencer);
                setMessages(undefined);
                console.log("Influencer", localInfluencer)
            } else {
                const localInfluencer = await influencerRepo.getInfluencer(id);
                console.log("Influencer", localInfluencer)
                setInfluencer(localInfluencer);
                setMessages(undefined);
            }
        })()
    }, [id, user_id]);

    const fetchMessages = async (chat_id: string, page: number) => {
        try {
            const responseMessagesPagination: MessagePagination = await chatRepository.getChatHistory(chat_id, page, pageSize);
            const totalPages = responseMessagesPagination.total / pageSize;
            const localMessages = responseMessagesPagination.messages;
            if (page === 1) {
                setMessages(responseMessagesPagination.messages);
            } else {
                setMessages(prev => prev ? [...localMessages, ...prev] : localMessages);
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
                const chat_id = await chatRepository.getChatId(user.id, influencer.id)
                setChatId(chat_id);
                setPageNumber(1);
                setHasMore(true);
                fetchMessages(chat_id, 1);
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
        ws.current = new window.WebSocket(`${WS_BASE_URL}${Endpoints.ws.chat}/${influencerId}?token=${access_token}`);
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

    // async function sendAndPlay(audioBlob: Blob) {
    //     if (!influencer) return;
    //     if (!chatId) return;

    //     const formData = new FormData();
    //     formData.append("file", audioBlob);
    //     formData.append("persona_id", influencer.id);
    //     formData.append("chat_id", chatId);
    //     const response = await fetch(`${Endpoints.CHAT_AUDIO}`, {
    //         method: "POST",
    //         body: formData,
    //     });
    //     if (!response.ok) {
    //         alert("Failed to get AI audio");
    //         return;
    //     }
    //     const blob = await response.blob();
    //     setMessages((prev) => {
    //         if (!prev) return;
    //         return [
    //             ...prev,
    //             {
    //                 id: Date.now(),
    //                 sender: "received",
    //                 text: "audio",
    //                 time: new Date().toLocaleTimeString([], {
    //                     hour: "2-digit",
    //                     minute: "2-digit",
    //                 }),
    //                 attachments: [
    //                     {
    //                         blob: blob,
    //                         type: "audio",
    //                     },
    //                 ],
    //             },
    //         ]
    //     });
    //     scrollToBottom();
    // }

    async function sendAndPlay(audioBlob: Blob) {
        if (!influencer) return;
        if (!chatId) return;
        const access_token = storage.get(LocalStorageKeys.AccessToken);
        const formData = new FormData();
        formData.append("file", audioBlob, "audio.webm");
        formData.append("persona_id", influencer.id);
        formData.append("chat_id", chatId);
        formData.append("token", access_token ?? "");
        const response = await fetch(`${Endpoints.chat_audio}`, {
            method: "POST",
            body: formData,
        });
        if (!response.ok) {
            alert("Failed to get AI audio");
            return;
        }
        const data: ChatAudioResponse = await response.json();
        console.log("AI Audio Response:", data);

        setMessages((prev) => {
            if (!prev) return prev;
            return [
                ...prev,
                {
                    id: Date.now(),
                    sender: "received",
                    text: data.ai_text || "audio",
                    time: new Date().toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                    }),
                    attachments: data.ai_audio_url
                        ? [
                            {
                                audioUrl: data.ai_audio_url,
                                type: "audio",
                            },
                        ]
                        : [],
                },
            ];
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
        navigate("/voice", {
            state: {
                influencer_id: id
            }
        })
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