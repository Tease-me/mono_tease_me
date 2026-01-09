import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';

import { Endpoints, WS_BASE_URL } from "@/api/urls";
import ProfileMedia from "@/ui/components/ProfileMedia";
import { truncateLastName } from "@/utils/StringUtils";
import { AuthContext } from "@/context/AuthContext";
import styles from "./ChatScreenContent.module.css"
import { useNavigate, useParams } from 'react-router-dom';
import MessageBubble, { CallMessageGroup } from './MessageBubble';
import ChatInputArea from './ChatInputArea';
import TeaseMeLogo from '@/ui/components/logos/TeaseMeLogo';
//import ChatTopNav from '@/ui/components/nav/ChatTopNav';
import UserNav from '@/ui/components/nav/UserNav';
import { InfluencerDataModel } from '@/data/models/InfluencerDataModel';
import { Message, MessagePagination } from '@/data/models/MessageDataModel';
import { storage } from '@/utils/storage';
import { LocalStorageKeys } from '@/constants/localStorageKeys';
import LoadingSpinner from '@/ui/components/loading/LoadingSpinner';
import clsx from 'clsx';
import { ChatRepository } from '@/data/repositories/ChatRepo';
import { InfluencerRepo } from '@/data/repositories/InfluencerRepo';
import logger from '@/utils/logger';
import CallModal from '@/ui/components/modals/call-modal/CallModal';
import useCallWebRTC from '@/hooks/useCallWebRTC';
import IconButton from '@/ui/components/inputs/buttons/IconButton';
import { DropDownMenuDataModel } from '@/ui/components/inputs/dropdown/DropDownMenu';
import LogoutIcon from "@/assets/svg/Logout.svg?react";
import ProfileIcon from "@/assets/svg/Profile.svg?react";
import SvgPack from '@/utils/SvgPack';
import { useTheme } from '@/theme/ThemeProvider';

type DisplayMessage = Message | CallMessageGroup;

const isCallGroup = (message: DisplayMessage): message is CallMessageGroup => {
    return (message as CallMessageGroup).type === "call-group";
};

const isCallChannel = (message: Message) => {
    if (!message.channel) return false;
    return message.channel.toLowerCase().startsWith("call");
};

const mergeCallMessages = (messageList: Message[]): DisplayMessage[] => {
    const merged: DisplayMessage[] = [];
    let currentCallGroup: CallMessageGroup | null = null;

    messageList.forEach((message) => {
        if (isCallChannel(message)) {
            const id = message.callId || `call-${message.id}`;
            const needsNew = !currentCallGroup || currentCallGroup.id !== id;

            if (needsNew) {
                currentCallGroup = {
                    id,
                    sender: "sent",
                    time: message.time,
                    messages: [],
                    type: "call-group",
                };
                merged.push(currentCallGroup);
            }

            currentCallGroup!.messages.push(message);
            currentCallGroup!.time = message.time;
            return;
        }

        currentCallGroup = null;
        merged.push(message);
    });

    return merged;
};

const MessagesList = React.memo(({ messages, typing, messagesEndRef, influencerName, onAudioPlay }: { messages: DisplayMessage[]; typing: boolean; messagesEndRef: React.RefObject<HTMLDivElement | null>; influencerName?: string; onAudioPlay?: (src: string) => void; }) => {
    return (
        <>
            <div className={styles["messages"]}>
                {messages.map((msg) => (
                    <MessageBubble
                        key={msg.id}
                        msg={!isCallGroup(msg) ? msg : undefined}
                        callGroup={isCallGroup(msg) ? msg : undefined}
                        influencerName={influencerName}
                        onAudioPlay={onAudioPlay}
                    />
                ))}
                {typing && <MessageBubble />}
            </div>
            <div ref={messagesEndRef} style={{ height: "50px" }} />
            {messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })}
        </>
    );
});

interface ChatScreenContentProps {
    id?: string;
    onBackPressed?: () => void;
    setNeedsSelection?: (needsSelection: boolean) => void;
    onMenuClick?: () => void;
}

const ChatScreenContent: React.FC<ChatScreenContentProps> = ({ id, onBackPressed, setNeedsSelection, onMenuClick }) => {
    const [influencer, setInfluencer] = useState<InfluencerDataModel>();
    const [chatId, setChatId] = useState<string | undefined>();

    const [messages, setMessages] = useState<Message[] | undefined>();
    const [inputText, setInputText] = useState("");
    const [inputAudio, setInputAudio] = useState<Blob>();
    const [typing, setTyping] = useState(false);
    const [isWsConnected, setIsWsConnected] = useState(false);
    const [error, setError] = useState<string | undefined>(undefined);
    const [openWelcomeCallModal, setOpenWelcomeCallModal] = useState(false);

    const [pageNumber, setPageNumber] = useState<number>(1);

    const [hasMore, setHasMore] = useState<boolean>(true);
    const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
    const [isClearingHistory, setIsClearingHistory] = useState<boolean>(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const ws = useRef<WebSocket | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const reconnectTimer = useRef<number | null>(null);
    const currentAudioRef = useRef<HTMLAudioElement | null>(null);

    const { user, logout } = useContext(AuthContext);
    const { user_id } = useParams();
    const isSuperUser = user?.id === 1;

    const pageSize = 20;

    const chatRepository = ChatRepository();
    const influencerRepo = InfluencerRepo();
    const { status, startConversation, stopConversation, setInfluencerId, timeRemaining, micMuted, toggleMute } = useCallWebRTC();
    const displayMessages = useMemo(() => messages ? mergeCallMessages(messages) : [], [messages]);
    const navigate = useNavigate();

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
            } else {
                const localInfluencer = await influencerRepo.getInfluencer(id);
                setInfluencer(localInfluencer);
                setMessages(undefined);
            }
        })()
    }, [id, user_id]);

    useEffect(() => {
        setTyping(false);
    }, [influencer]);

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
                setInfluencerId(influencer.id);
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

    useEffect(() => {
        if ((status === "disconnected" || status === "idle") && chatId) {
            const t = setTimeout(() => {
                fetchMessages(chatId, 1);
            }, 10000);
            return () => clearTimeout(t);
        }
    }, [status, chatId]);

    function calculateReplyTime(msg: string) {
        const replyTime = (msg.length * 100);
        console.error("Reply time: ", replyTime);
        return (replyTime);
    }

    const clearReconnectTimer = () => {
        if (reconnectTimer.current) {
            window.clearTimeout(reconnectTimer.current);
            reconnectTimer.current = null;
        }
    };

    const scheduleReconnect = (influencerId: string) => {
        if (reconnectTimer.current) return;
        reconnectTimer.current = window.setTimeout(() => {
            reconnectTimer.current = null;
            connectChat(influencerId);
        }, 5000);
    };

    function connectChat(influencerId: string) {
        ws.current?.close();
        const access_token = storage.get(LocalStorageKeys.AccessToken);
        ws.current = new window.WebSocket(`${WS_BASE_URL}${Endpoints.ws.chat}/${influencerId}?token=${access_token}`);
        ws.current.onopen = () => {
            setIsWsConnected(true);
            setError(undefined);
            clearReconnectTimer();
        };
        ws.current.onclose = () => {
            setIsWsConnected(false);
            setError("Disconnected. Reconnecting...");
            scheduleReconnect(influencerId);
        };
        ws.current.onerror = () => {
            setIsWsConnected(false);
            setError("Connection error. Reconnecting...");
            scheduleReconnect(influencerId);
        };
        ws.current.onmessage = (event) => {
            setTyping(false);
            console.warn("WebSocket message received:", event.data);
            const data = JSON.parse(event.data);
            if (data.reply) {
                setTyping(true);
                setTimeout(() => {
                    setMessages(prev => {
                        if (!prev) return
                        return [
                            ...prev,
                            {
                                id: Date.now(),
                                sender: "received",
                                text: data.reply,
                                channel: data.channel ?? "chat",
                                time: new Date().toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                }),
                                timestamp: Date.now(),
                            },
                        ]
                    });
                    setTyping(false);
                    scrollToBottom();
                    setError(undefined);
                }, calculateReplyTime(data.reply));
            } else if (data.error) {
                setTyping(false);
                logger.error("Error in WebSocket message:", data.error);
                setError(data.error || "An error occurred while sending the message.");
            }
        };
    }

    useEffect(() => {
        return () => {
            clearReconnectTimer();
            ws.current?.close();
        };
    }, []);

    async function sendAndPlay(audioBlob: Blob) {
        if (!influencer) return;
        if (!chatId) return;

        const { audio_url } = await chatRepository.sendAudioMessage(audioBlob, influencer.id, chatId);
        setTyping(false);
        setMessages((prev) => {
            if (!prev) return prev;
            return [
                ...prev,
                {
                    id: Date.now(),
                    sender: "received",
                    channel: "chat",
                    time: new Date().toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                    }),
                    timestamp: Date.now(),
                    attachments: audio_url
                        ? [
                            {
                                audioUrl: audio_url,
                                type: "audio",
                            },
                        ]
                        : [],
                },
            ];
        });
        scrollToBottom();
    }

    const sendMessage = (forcedAudio?: Blob) => {
        if (!influencer) return;

        const audioToSend = forcedAudio ?? inputAudio;

        if (inputText.trim()) {
            setTyping(false);
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
                        channel: "chat",
                        text: inputText,
                        time: new Date().toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                        }),
                        timestamp: Date.now(),
                    },
                ]
            });

            setInputText("");
        } else if (audioToSend) {
            setTyping(true);
            sendAndPlay(audioToSend);
            setMessages(prev => {
                if (!prev) return
                return [
                    ...prev,
                    {
                        id: Date.now(),
                        sender: 'sent',
                        channel: "chat",
                        time: new Date().toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                        }),
                        timestamp: Date.now(),
                        attachments: [
                            {
                                blob: audioToSend,
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
        startConversation();
        setOpenWelcomeCallModal(true);
    }
    {/** 
    const handleOnBackClick = () => {
        onBackPressed?.();
    };
    */}

    const handleScroll = async () => {

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

    const handleClearHistory = async () => {
        if (!chatId || !isSuperUser) return;
        const confirmed = window.confirm("Delete this chat history? This cannot be undone.");
        if (!confirmed) return;

        try {
            setIsClearingHistory(true);
            await chatRepository.clearChatHistory(chatId);
            setMessages([]);
            setHasMore(false);
            setPageNumber(1);
            setTyping(false);
        } catch (err) {
            logger.error("Error clearing chat history", err);
        } finally {
            setIsClearingHistory(false);
        }
    };
    const { theme, setTheme } = useTheme();
    const testDataDropDown: DropDownMenuDataModel[] = [
        {
            id: 1,
            icon: <ProfileIcon />,
            text: "My Profile",
            onClick: () => {
                navigate("/profile");
            },
        },
        {
            id: 2,
            icon: <SvgPack.Female />,
            text: "Change Influencer",
            onClick: () => {
                setNeedsSelection?.(true);
            }
        },
        {
            id: 3,
            icon: <SvgPack.Heart />,
            text: "Change Theme",
            onClick: () => {
                setTheme(theme === "default" ? "adult" : "default");
            }
        },
        {
            id: 4,
            icon: <LogoutIcon />,
            text: "Logout",
            styles: {
                style: { color: "var(--color-alert)" },
                hoverStyle: { color: "var(--color-primary)" },
                iconStyle: { color: "var(--color-primary)" },
            },
            onClick: () => {
                logout();
            },
        },
    ];

    if (!influencer) return <div className={styles["empty-chat-screen"]}><TeaseMeLogo size='xlarge' variant='mono-lips-only' style={{ color: "rgba(255, 255, 255, 0.5)" }} /></div>;
    return (
        <div className={styles["chat-screen-content"]}>
            <div className={styles["chat-header"]}>
                {/*<ChatTopNav onBack={handleOnBackClick} onCallClick={onCall} menuItems={testDataDropDown} /> */}
                <UserNav
                    influencerName={influencer?.name}
                    onMenuClick={onMenuClick}
                    onCallClick={onCall}
                />
                <div className={styles["chat-header-info"]}>
                    <ProfileMedia imageSrc={influencer?.img} mediaType="image" size="xsmall" active className={styles["chat-avatar"]} />
                    <div className={styles["chat-user-name"]}>
                        <h3><a href={`/${influencer.username}`}>{influencer && truncateLastName(influencer?.name)}</a></h3>
                        <p>{isWsConnected ? "Connected" : "Not Connected"}</p>
                    </div>
                    {isSuperUser && chatId && (
                        <div className={styles["admin-actions"]}>
                            <IconButton
                                onClick={handleClearHistory}
                                color='red'
                                text={isClearingHistory ? "Clearing..." : "Clear history"}
                                className={styles["clear-history-button"]}
                                disabled={isClearingHistory}
                            />
                        </div>
                    )}
                </div>
            </div>

            <div
                className={clsx(styles["chat-messages-container"], !messages && styles["loading"])}
                ref={containerRef}
                onScroll={handleScroll}
            >
                {(messages) ? <>
                    {isLoadingMore && <LoadingSpinner size='small' />}
                    <MessagesList
                        messages={displayMessages}
                        typing={typing}
                        messagesEndRef={messagesEndRef}
                        influencerName={influencer?.name}
                        onAudioPlay={(src) => {
                            // Pause any currently playing audio
                            if (currentAudioRef.current && currentAudioRef.current.src !== src) {
                                currentAudioRef.current.pause();
                                currentAudioRef.current.currentTime = 0;
                            }
                            // Track the newly started audio element
                            const audioEl = document.querySelector<HTMLAudioElement>(`audio[src="${src}"]`);
                            if (audioEl) {
                                currentAudioRef.current = audioEl;
                            }
                        }}
                    />
                </> : <LoadingSpinner />}
            </div>

            <div className={styles["chat-input-area"]}>
                <ChatInputArea
                    onSendMessage={sendMessage}
                    inputText={inputText}
                    setInputText={setInputText}
                    setInputAudio={setInputAudio}
                    disabled={error ? true : false}
                    error={error}
                    inputAudio={inputAudio} />
            </div>
            <CallModal
                timeRemaining={timeRemaining}
                status={status}
                isOpen={openWelcomeCallModal}
                onClose={() => setOpenWelcomeCallModal(false)}
                stopConversation={stopConversation}
                influencer={influencer}
                micMuted={micMuted}
                toggleMute={toggleMute} />
        </div>
    );
};

export default ChatScreenContent;
