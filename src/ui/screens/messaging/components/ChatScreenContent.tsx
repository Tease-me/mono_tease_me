import React, { memo, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { Endpoints, WS_BASE_URL } from "@/api/urls";
import { AuthContext } from "@/context/AuthContext";
import styles from "./ChatScreenContent.module.css"
import { useParams } from 'react-router-dom';
import { CallMessageGroup } from './MessageBubble';
import MessagesList, { DisplayMessage } from './MessageList';
import ChatInputArea from './ChatInputArea';
import TeaseMeLogo from '@/ui/components/logos/TeaseMeLogo';
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
import { DropDownMenuDataModel } from '@/ui/components/inputs/dropdown/DropDownMenu'
import { AdultChatRepo } from '@/data/repositories/AdultChatRepo';
import { SubscriptionsServices } from '@/api/services/SubscriptionsServices';
import { apiClient } from '@/api/apis';
import AdultModePage from '../../adult-mode/AdultModePage';
import UserNav from '@/ui/components/nav/UserNav';
import { Modal } from '@/ui/components/modals/Modal';
import NormalButton from '@/ui/components/inputs/buttons/NormalButton';
import SvgPack from '@/utils/SvgPack';
import ChatInfluencerBar from './ChatInfluencerBar';
import ChatHeaderInfo from './ChatHeaderInfo';
import { RelationshipServices } from '@/api/services/RelationshipServices';
import { RelationshipResponse } from '@/api/models/relationship';

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
const chatRepository = ChatRepository();
const influencerRepo = InfluencerRepo();
const adultChatRepo = AdultChatRepo();
const subscriptionsServices = SubscriptionsServices(apiClient);
const relationshipServices = RelationshipServices(apiClient);

interface ChatScreenContentProps {
    id?: string;
    onBackPressed?: () => void;
    menuItems?: DropDownMenuDataModel[];
    setNeedsSelection?: (needsSelection: boolean) => void;
    onMenuClick?: () => void;
    showChangeInfluencerButton?: boolean;
}

const ChatScreenContent: React.FC<ChatScreenContentProps> = ({ id, onMenuClick, setNeedsSelection, showChangeInfluencerButton = false }) => {
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
    const lastChatInitRef = useRef<string | null>(null);
    const callModalTimeoutRef = useRef<number | null>(null);

    const { user } = useContext(AuthContext);
    const [adultMode, setAdultMode] = useState(false);
    const [adultModeSwitch, setAdultModeSwitch] = useState(false);
    const [showSubscriptionPage, setShowSubscriptionPage] = useState(false);
    const [showErrorAlert, setShowErrorAlert] = useState<string | undefined>();
    const [relationship, setRelationship] = useState<RelationshipResponse | undefined>();

    const { user_id } = useParams();

    const isSuperUser = user?.id === 1;

    const pageSize = 20;

    const { status, startConversation, stopConversation, setInfluencerId, timeRemaining, micMuted, toggleMute } = useCallWebRTC();
    const displayMessages = useMemo(() => messages ? mergeCallMessages(messages) : [], [messages]);

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
        let isMounted = true;

        const checkSubscription = async () => {
            if (!influencer) {
                setTyping(false);
                return;
            }
            try {
                const subscription = await subscriptionsServices.getMySubscriptionForInfluencer(influencer.id);
                const isActive = subscription?.status === "active";
                const isAdult = isActive && subscription?.is_18_selected === true;
                if (isMounted) {
                    setAdultModeSwitch(isAdult);
                    setAdultMode(isAdult);
                }
            } catch (err) {
                setAdultModeSwitch(false);
                setAdultMode(false);
                logger.error("Error checking subscription for influencer:", err);
            } finally {
                if (isMounted) {
                    setTyping(false);
                }
            }
        };

        checkSubscription();

        return () => {
            isMounted = false;
        };
    }, [influencer]);

    const handleAdultModeChange = async (checked: boolean) => {
        if (!influencer) {
            setAdultModeSwitch(false);
            return;
        }
        setAdultModeSwitch(checked);
        if (!checked) {
            await subscriptionsServices.activateMySubscriptionForInfluencer(influencer.id, false);
        }
    };

    useEffect(() => {
        (async () => {
            if (adultModeSwitch && influencer) {
                try {
                    const subscription = await subscriptionsServices.getMySubscriptionForInfluencer(influencer.id);
                    if (subscription?.status === "active") {
                        await subscriptionsServices.activateMySubscriptionForInfluencer(influencer.id, true);
                        setShowSubscriptionPage(false);
                        setAdultMode(true);
                    } else {
                        setShowSubscriptionPage(true);
                        setAdultMode(false);
                    }
                } catch (err) {
                    logger.error("Error enabling adult mode subscription:", err);
                    setAdultModeSwitch(false);
                    setShowSubscriptionPage(false);
                }

            } else {
                setShowSubscriptionPage(false);
                setAdultMode(false);
            }
        })();
    }, [adultModeSwitch]);

    const handleSubscribePressed = () => {
        (async () => {
            if (!influencer) return;
            try {
                const startResponse = await subscriptionsServices.startSubscription(influencer.id);
                const orderId =
                    typeof crypto !== "undefined" && "randomUUID" in crypto
                        ? crypto.randomUUID()
                        : `order_${Date.now()}_${Math.random().toString(16).slice(2)}`;
                const subscriptionId = startResponse?.subscription_id ?? startResponse?.subscriptionId;
                const amountCents = 10000;

                if (!orderId || !subscriptionId || !amountCents) {
                    throw new Error("Missing subscription capture data");
                }

                await subscriptionsServices.captureSubscription(orderId, String(subscriptionId), amountCents);
                await subscriptionsServices.activateMySubscriptionForInfluencer(influencer.id, true);
                setAdultMode(true);
                setShowSubscriptionPage(false);
            } catch (err) {
                logger.error("Error during subscription process:", err);
                return;
            }
        })();
    };

    const fetchMessages = async (chat_id: string, page: number) => {
        try {
            const responseMessagesPagination: MessagePagination = await (adultMode ? adultChatRepo.getChatHistory(chat_id, page, pageSize) : chatRepository.getChatHistory(chat_id, page, pageSize));

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
                const initKey = `${user.id}-${influencer.id}-${adultMode}`;
                if (lastChatInitRef.current === initKey) {
                    return;
                }
                lastChatInitRef.current = initKey;
                const chat_id = await (adultMode ? adultChatRepo.getChatId(user.id, influencer.id) : chatRepository.getChatId(user.id, influencer.id));
                setChatId(chat_id);
                setPageNumber(1);
                setHasMore(true);
                fetchMessages(chat_id, 1);
                connectChat(influencer.id);
                setInfluencerId(influencer.id);
                relationshipServices.getRelationship(influencer.id).then((relationship) => {
                    setRelationship(relationship)
                })
            }
        })()
    }, [influencer, user, adultMode]);

    useEffect(() => {
        if (pageNumber === 1) {
            scrollToBottom();
        }
    }, [messages])

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (status === "connecting")
            setOpenWelcomeCallModal(true)

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
        ws.current = new window.WebSocket(`${WS_BASE_URL}${adultMode ? Endpoints.ws.chat18 : Endpoints.ws.chat}/${influencerId}?token=${access_token}`);

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
            if (callModalTimeoutRef.current) {
                window.clearTimeout(callModalTimeoutRef.current);
                callModalTimeoutRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (!openWelcomeCallModal) {
            if (callModalTimeoutRef.current) {
                window.clearTimeout(callModalTimeoutRef.current);
                callModalTimeoutRef.current = null;
            }
            return;
        }

        if (status === "connected" || status === "connecting") {
            if (callModalTimeoutRef.current) {
                window.clearTimeout(callModalTimeoutRef.current);
                callModalTimeoutRef.current = null;
            }
            return;
        }

        callModalTimeoutRef.current = window.setTimeout(() => {
            setOpenWelcomeCallModal(false);
            callModalTimeoutRef.current = null;
        }, 2500);

        return () => {
            if (callModalTimeoutRef.current) {
                window.clearTimeout(callModalTimeoutRef.current);
                callModalTimeoutRef.current = null;
            }
        };
    }, [openWelcomeCallModal, status]);

    async function sendAndPlay(audioBlob: Blob, sentMessageId?: number) {
        if (!influencer) return;
        if (!chatId) return;

        const { audio_url, transcript, ai_text } = await (adultMode ? adultChatRepo : chatRepository).sendAudioMessage(audioBlob, influencer.id, chatId);

        setTyping(false);
        setMessages((prev) => {
            if (!prev) return prev;
            const nextMessages = prev.map((message) => {
                if (!sentMessageId || message.id !== sentMessageId) {
                    return message;
                }
                return {
                    ...message,
                    transcript: isSuperUser ? (transcript ?? message.transcript) : message.transcript,
                };
            });
            return [
                ...nextMessages,
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
                    transcript: isSuperUser ? ai_text : undefined,
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
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
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
            const sentMessageId = Date.now();
            sendAndPlay(audioToSend, sentMessageId);
            setMessages(prev => {
                if (!prev) return
                return [
                    ...prev,
                    {
                        id: sentMessageId,
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
    }

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
    const handleChangeInfluencerClicked = async () => {
        setNeedsSelection?.(true)
    };
    const handleClearHistory = async () => {
        if (!chatId || !isSuperUser) return;
        const confirmed = window.confirm("Delete this chat history? This cannot be undone.");
        if (!confirmed) return;

        try {
            setIsClearingHistory(true);
            await chatRepository.clearChatHistory(chatId, adultMode);
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

    if (!influencer) return <div className={styles["empty-chat-screen"]}><TeaseMeLogo size='xlarge' variant='mono-lips-only' style={{ color: "rgba(255, 255, 255, 0.5)" }} /></div>;

    return (
        <div className={styles["container"]}>
            <div className={styles["chat-screen-content"]}>
                <div className={styles["chat-header"]}>
                    <UserNav
                        influencerName={influencer?.name}
                        onMenuClick={onMenuClick}
                        onCallClick={onCall}
                        adultMode={adultModeSwitch}
                        onAdultModeChange={handleAdultModeChange}
                    />
                </div>
                {!showSubscriptionPage ? <>
                    {isSuperUser && <ChatHeaderInfo
                        isWsConnected={isWsConnected}
                        isSuperUser={isSuperUser}
                        chatId={chatId}
                        isClearingHistory={isClearingHistory}
                        onChangeInfluencer={handleChangeInfluencerClicked}
                        onClearHistory={handleClearHistory}
                    />}
                    <ChatInfluencerBar
                        relationship={relationship}
                        influencer={influencer}
                        status={isWsConnected ? "Connected" : "Not Connected"}
                        adultMode={adultMode}
                        showChangeInfluencerButton={showChangeInfluencerButton}
                        onChangeInfluencer={handleChangeInfluencerClicked}
                    />
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
                                showAudioTranscript={isSuperUser}
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
                            adultMode={adultMode}
                            onSendMessage={sendMessage}
                            inputText={inputText}
                            setInputText={setInputText}
                            setInputAudio={setInputAudio}
                            disabled={error ? true : false}
                            error={error}
                            inputAudio={inputAudio} />
                    </div>
                </> : (
                    <AdultModePage
                        onSubscribePressed={handleSubscribePressed}
                        influencerId={influencer?.id}
                        influencerImageUrl={influencer?.img}
                    />
                )}

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
            <Modal isOpen={!(!showErrorAlert)} onClose={() => {
                setShowErrorAlert(undefined);
            }}
                className={styles.cancelModal}>
                <div className={styles.modalCard}>
                    <>
                        <h3>Alert</h3>
                        <p>{showErrorAlert}</p>
                        <div className={styles.modalActions}>
                            <NormalButton type="nobg" onClick={() => setShowErrorAlert(undefined)} text="Cancel" />
                            <IconButton
                                leftIcon={<SvgPack.Danger />}
                                text={"Confirm"}
                            />
                        </div>
                    </>
                </div>
            </Modal>

        </div>
    );
};

export default memo(ChatScreenContent);
