import React, { memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { Endpoints, WS_BASE_URL } from "@/api/urls";
import { AuthContext } from "@/context/AuthContext";
import styles from "./ChatScreenContent.module.css"
import MessagesList from './MessageList';
import ChatInputArea from './ChatInputArea';
import TeaseMeLogo from '@/ui/components/logos/TeaseMeLogo';
import { InfluencerDataModel } from '@/data/models/InfluencerDataModel';
import { Message, MessagePagination } from '@/data/models/MessageDataModel';
import { storage } from '@/utils/storage';
import { LocalStorageKeys } from '@/constants/localStorageKeys';
import LoadingSpinner from '@/ui/components/loading/LoadingSpinner';
import clsx from 'clsx';
import { secondsToMinutes } from '@/utils/DateTimeUtils';
import { ChatRepository } from '@/data/repositories/ChatRepo';
import { InfluencerRepo } from '@/data/repositories/InfluencerRepo';
import logger from '@/utils/logger';
import useCallWebRTC from '@/hooks/useCallWebRTC';
import { useChatScroll } from '@/hooks/useChatScroll';
import IconButton from '@/ui/components/inputs/buttons/IconButton';
import { DropDownMenuDataModel } from '@/ui/components/inputs/dropdown/DropDownMenu'
import { AdultChatRepo } from '@/data/repositories/AdultChatRepo';
import { SubscriptionsServices } from '@/api/services/SubscriptionsServices';
import { apiClient } from '@/api/apis';
import AdultModePage from '../pages/adult-mode/AdultModePage';
import UserNav from '@/ui/components/nav/UserNav';
import { Modal } from '@/ui/components/modals/Modal';
import NormalButton from '@/ui/components/inputs/buttons/NormalButton';
import SvgPack from '@/utils/SvgPack';
import ChatInfluencerBar from './ChatInfluencerBar';
import ChatHeaderInfo from './ChatHeaderInfo';
import { RelationshipServices } from '@/api/services/RelationshipServices';
import CallModePage from '../pages/call-page/CallModePage';
import { RelationshipDataModel } from '@/data/models/RelationshipDataModel';
import AdultConvoStarterCard from '@/ui/components/cards/AdultConvoStarterCard';
import { mergeCallMessages } from './messageUtils';
import { UserServices } from '@/api/services/UserServices';
import UpgradePlanModal from '@/ui/components/modals/subscription/UpgradePlanModal';
import AddCreditsModal from '@/ui/components/modals/payment-modal/AddCreditsModal';
import AdultTermsModal from '@/ui/components/modals/adult-terms/AdultTermsModal';
import { useSidebar } from '@/hooks/useSidebar';
import InfluencerSelector from '@/ui/screens/influencer/InfluencerSelector';

const chatRepository = ChatRepository();
const influencerRepo = InfluencerRepo();
const adultChatRepo = AdultChatRepo();
const subscriptionsServices = SubscriptionsServices(apiClient);
const relationshipServices = RelationshipServices(apiClient);

interface ChatScreenContentProps {
    defaultInfluencerId?: string;
    onBackPressed?: () => void;
    menuItems?: DropDownMenuDataModel[];
    onMenuClick?: () => void;
    openSubscribe?: boolean;
}
export type TypingStatus = "idle" | "typing" | "recording";

const ChatScreenContent: React.FC<ChatScreenContentProps> = ({ defaultInfluencerId, onMenuClick, openSubscribe }) => {
    const [selectedId, setSelectedId] = useState<string | undefined>(() => {
        const stored = localStorage.getItem("selected_id");
        return stored || undefined;
    });
    const [needsSelection, setNeedsSelection] = useState(false);
    const [influencers, setInfluencers] = useState<InfluencerDataModel[]>([]);
    const [hasMultipleInfluencers, setHasMultipleInfluencers] = useState(false);
    const skipInfluencerResetRef = useRef(false);

    const [influencer, setInfluencer] = useState<InfluencerDataModel>();
    const [chatId, setChatId] = useState<string | undefined>();

    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const [inputText, setInputText] = useState("");
    const [inputAudio, setInputAudio] = useState<Blob>();
    const [typing, setTyping] = useState<TypingStatus>("idle");
    const [isWsConnected, setIsWsConnected] = useState(false);
    const [error, setError] = useState<string | undefined>(undefined);

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
    const { openSidebar } = useSidebar();
    const [adultMode, setAdultMode] = useState(false);
    const adultModeRef = useRef(false);
    useEffect(() => { adultModeRef.current = adultMode; }, [adultMode]);
    const [adultModeSwitch, setAdultModeSwitch] = useState(false);
    const [hasSubscription, setHasSubscription] = useState(false);
    const storedMode = storage.get(LocalStorageKeys.PreferredChatMode);
    const [mode, setMode] = useState<"chat" | "call">(storedMode == null ? "call" : storedMode === "call" ? "call" : "chat");
    const [showSubscriptionPage, setShowSubscriptionPage] = useState(false);
    const [showErrorAlert, setShowErrorAlert] = useState<string | undefined>();
    const [relationship, setRelationship] = useState<RelationshipDataModel | undefined>();
    const [creditsRemaining, setCreditsRemaining] = useState<number | undefined>(undefined);
    const [adultMinutesRemaining, setAdultMinutesRemaining] = useState<number | undefined>(undefined);

    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [showTopupModal, setShowTopupModal] = useState(false);

    const [showTermsModal, setShowTermsModal] = useState(false);

    const [callTime, setCallTime] = useState(0);
    const isSuperUser = user?.id === 1;

    const pageSize = 20;

    const fetchRelationship = (influencerId?: string) => {
        if (!influencerId && influencer) {
            influencerId = influencer.id;
        }
        if (!influencerId) {
            logger.error("No influencer ID available to fetch relationship");
            return;
        }

        relationshipServices.getRelationship(influencerId).then((relationship) => {
            setRelationship(relationship);
        }).catch((err) => logger.error("Error refreshing relationship", err));
    };

    const { status, startConversation, stopConversation, setInfluencerId, micMuted, toggleMute, errorMessage, cancelCall } = useCallWebRTC({
        onMessage: (message) => {
            logger.debug("Received WebRTC message on ChatScreenContent:", message);
            fetchRelationship();
        }
    });

    const displayMessages = useMemo(() => messages ? mergeCallMessages(messages) : [], [messages]);
    useEffect(() => {
        setMode(prev => {
            if (prev === "call" && adultMode) {
                return "chat"
            }
            return prev;
        });
    }, [adultMode]);

    useEffect(() => {
        storage.set(LocalStorageKeys.PreferredChatMode, mode);
    }, [mode]);

    useEffect(() => {
        (async () => {
            if (!selectedId) { setInfluencer(undefined); return; }
            const localInfluencer = await influencerRepo.getInfluencer(selectedId);
            setInfluencer(localInfluencer);
        })()
    }, [selectedId]);

    useEffect(() => {
        localStorage.setItem("selected_id", selectedId?.toString() || "");
    }, [selectedId]);

    useEffect(() => {
        influencerRepo.getFollowedInfluencers().then((list: InfluencerDataModel[]) => {
            if (!skipInfluencerResetRef.current) {
                if (list.length > 1 && !selectedId) {
                    setNeedsSelection(true);
                } else if (list.length === 1) {
                    setSelectedId(list[0].id);
                }
            }
            setHasMultipleInfluencers(list.length > 1);
            setInfluencers(list);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (defaultInfluencerId) {
            skipInfluencerResetRef.current = true;
            setSelectedId(defaultInfluencerId);
            setNeedsSelection(false);
        }
    }, [defaultInfluencerId]);

    useEffect(() => {
        let isMounted = true;
        UserServices(apiClient).getUserUsage(influencer?.id).then((usage) => {
            if (isMounted) {
                adultModeRef.current ? setCreditsRemaining(usage.adult?.messages?.remaining) : setCreditsRemaining(usage.normal?.messages?.remaining);
                setAdultMinutesRemaining(usage.adult?.live_chat?.remaining_minutes ?? usage.adult?.voice?.remaining_minutes)
            }
        }).catch((err) => {
            logger.error("Error fetching user usage:", err);
        });
        return () => { isMounted = false; };
    }, [influencer, adultMode]);

    useEffect(() => {
        let isMounted = true;
        const checkSubscription = async () => {
            if (!influencer) {
                setTyping("idle");
                return;
            }
            try {
                const subscription = await subscriptionsServices.getMySubscriptionForInfluencer(influencer.id);
                const isActive = subscription?.has_subscription === true && subscription?.status === 'active';
                const isAdult = isActive && subscription?.is_18_selected === true;
                if (isMounted) {
                    setHasSubscription(isActive);
                    setAdultModeSwitch(isAdult);
                    setAdultMode(isAdult);
                }
            } catch (err) {
                setHasSubscription(false);
                setAdultModeSwitch(false);
                setAdultMode(false);
                logger.error("Error checking subscription for influencer:", err);
            } finally {
                if (isMounted) {
                    setTyping("idle");
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
            try {
                await subscriptionsServices.activateMySubscriptionForInfluencer(influencer.id, false);
            } catch (err) {
                logger.error("Error deactivating adult mode:", err);
            }
        }
    };

    useEffect(() => {
        (async () => {
            if (adultModeSwitch && influencer) {
                try {
                    const subscription = await subscriptionsServices.getMySubscriptionForInfluencer(influencer.id);
                    if (subscription?.has_subscription === true && subscription?.status === 'active') {
                        if (!subscription?.is_18_selected) {
                            await subscriptionsServices.activateMySubscriptionForInfluencer(influencer.id, true);
                        }
                        setShowSubscriptionPage(false);
                        setAdultMode(true);
                    } else {
                        try {
                            await subscriptionsServices.activateMySubscriptionForInfluencer(influencer.id, true);
                            setShowSubscriptionPage(true);
                            setAdultMode(false);
                        } catch (activateErr: any) {
                            const idVerified = activateErr?.response?.data?.detail?.verification_status?.is_identity_verified;
                            if (idVerified === false) {
                                setShowTermsModal(true);
                                setAdultModeSwitch(false);
                                return;
                            }
                            setShowSubscriptionPage(true);
                            setAdultMode(false);
                        }
                    }
                }
                catch (err: any) {
                    const idVerified = err?.response?.data?.detail?.verification_status?.is_identity_verified;
                    if (idVerified === false) {
                        setShowTermsModal(true);
                        setAdultModeSwitch(false);
                        return;
                    }
                    logger.error("Error enabling adult mode subscription:", err);
                    setAdultModeSwitch(false);
                    setShowSubscriptionPage(false);
                    setShowErrorAlert(err?.response?.data?.detail?.message || "Failed to enable adult mode. Please try again.");
                }

            } else {
                setShowSubscriptionPage(false);
                setAdultMode(false);
            }
        })();
    }, [adultModeSwitch]);

    useEffect(() => {
        if (openSubscribe) {
            setShowSubscriptionPage(true);
        }
    }, [openSubscribe]);

    const handleSubscribePressed = () => {
        (async () => {
            if (!influencer) return;
            try {
                // Used placeholder 1 for plan id for now
                const startResponse = await subscriptionsServices.startSubscription(influencer.id, 1);
                const orderId =
                    typeof crypto !== "undefined" && "randomUUID" in crypto
                        ? crypto.randomUUID()
                        : `order_${Date.now()}_${Math.random().toString(16).slice(2)}`;
                const subscriptionId = startResponse?.subscription_id ?? startResponse?.subscriptionId;
                const amountCents = 10000;

                if (!orderId || !subscriptionId || !amountCents) {
                    throw new Error("Missing subscription capture data");
                }

                await subscriptionsServices.captureSubscription(String(subscriptionId), orderId, amountCents);
                await subscriptionsServices.activateMySubscriptionForInfluencer(influencer.id, true);
                window.alert("Subscription successful!");
                setAdultMode(true);
                setShowSubscriptionPage(false);
            } catch (err: any) {
                logger.error("Error during subscription process:", err);
                window.alert(err?.response?.data?.detail?.message ?? err?.message ?? "Error subscribing. Please try again.");
                return;
            }
        })();
    };

    const fetchMessages = async (chat_id: string, page: number) => {
        try {
            if (page === 1) {
                setIsLoadingMessages(true);
            }
            const responseMessagesPagination: MessagePagination = await (adultMode ? adultChatRepo.getChatHistory(chat_id, page, pageSize) : chatRepository.getChatHistory(chat_id, page, pageSize));

            const totalPages = Math.ceil(responseMessagesPagination.total / pageSize);
            const localMessages = responseMessagesPagination.messages ?? [];
            if (page === 1) {
                setMessages(localMessages);
            } else {
                setMessages(prev => prev ? [...localMessages, ...prev] : localMessages);
            }
            setHasMore(page < totalPages);
        } catch (err) {
            console.error('Error loading messages', err);
            if (page === 1) {
                setMessages([]);
                setHasMore(false);
            }
        } finally {
            if (page === 1) {
                setIsLoadingMessages(false);
            }
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
                setMessages([]);
                const chat_id = await (adultMode ? adultChatRepo.getChatId(user.id, influencer.id) : chatRepository.getChatId(user.id, influencer.id));
                setChatId(chat_id);
                setPageNumber(1);
                setHasMore(true);
                await fetchMessages(chat_id, 1);
                connectChat(influencer.id);
                setInfluencerId(influencer.id);
                fetchRelationship(influencer.id);
                setIsLoadingMore(false);
            }

        })()
    }, [influencer, user, adultMode]);

    const { scrollToBottom, handleScroll } = useChatScroll({
        messagesEndRef: messagesEndRef,
        loadMore: async (container) => {
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
        },
    });

    useEffect(() => {
        if (pageNumber === 1) {
            scrollToBottom();
        }
    }, [messages, pageNumber, scrollToBottom])

    function calculateReplyTime(msg: string) {
        const replyTime = (msg.length * 50);
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

        const connectionChatId = chatId;
        const connectionAdultMode = adultMode;

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
            setTyping("idle");
            console.warn("WebSocket message received:", event.data);
            const data = JSON.parse(event.data);
            if (data.reply) {
                setTyping("typing");
                if (data.usage) {
                    adultModeRef.current ? setCreditsRemaining(data.usage.adult?.messages?.remaining) : setCreditsRemaining(data.usage.normal?.messages?.remaining);
                    const voiceSeconds = data.usage.adult?.voice_seconds?.remaining;
                    setAdultMinutesRemaining(voiceSeconds != null ? secondsToMinutes(voiceSeconds) : undefined)
                }
                setTimeout(() => {
                    if (chatId !== connectionChatId || adultModeRef.current !== connectionAdultMode) {
                        return;
                    }

                    setMessages(prev => {
                        if (!prev) return [];
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
                    setTyping("idle");
                    scrollToBottom();
                    setError(undefined);
                    if (data.relationship) {
                        setRelationship(data.relationship)
                        logger.debug("Relationship Updated:", data.relationship)
                    }
                }, calculateReplyTime(data.reply));
            } else if (data.error) {

                setTyping("idle");
                logger.error("Error in WebSocket message:", data.error);
                if (data.error === "INSUFFICIENT_CREDITS") {
                    setError("Insufficient credits to send message.");
                    if (adultMode) {
                        setShowUpgradeModal(true);
                    } else {
                        setShowTopupModal(true);
                    }
                } else {
                    if (typeof data.error === "string") {
                        setError(data.error);
                    } else {
                        setError("An error occurred while sending the message.");
                    }

                }
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
        if (status === "connected") {
            setCallTime(0);
            const interval = setInterval(() => {
                setCallTime(prev => prev + 1);
            }, 1000);

            return () => clearInterval(interval);
        } else {
            setCallTime(0);
        }
    }, [status])

    async function sendAndPlay(audioBlob: Blob, sentMessageId?: number) {
        if (!influencer) return;
        if (!chatId) return;

        const capturedMode = adultMode;
        const capturedChatId = chatId;

        try {

            const { audio_url, transcript, ai_text } = await (capturedMode ? adultChatRepo : chatRepository).sendAudioMessage(audioBlob, influencer.id, capturedChatId);

            if (adultModeRef.current !== capturedMode || chatId !== capturedChatId) {
                return;
            }

            setTyping("recording");
            setTimeout(() => {
                if (adultModeRef.current !== capturedMode || chatId !== capturedChatId) {
                    return;
                }

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
                setTyping("idle");
                scrollToBottom();
            }, 5000);
        } catch (err: any) {
            setTyping("idle");
            if (err?.response?.status === 402) {
                setError("Insufficient credits to send voice message.");
                setShowUpgradeModal(true);
            } else {
                setError("Failed to send voice message.");
            }
            logger.error("Error sending voice message:", err);
        }
    }

    const sendMessage = (forcedAudio?: Blob): boolean => {
        if (!influencer) return false;

        const audioToSend = forcedAudio ?? inputAudio;

        if (inputText.trim()) {
            if (!chatId) {
                setError("Chat is still loading. Please wait.");
                setTyping("idle");
                return false;
            }
            const socket = ws.current;
            if (!socket || socket.readyState !== WebSocket.OPEN) {
                setError("Not connected. Reconnecting...");
                setTyping("idle");
                return false;
            }
            setTyping("idle");
            try {
                socket.send(
                    JSON.stringify({
                        chat_id: chatId,
                        message: inputText.trim(),
                        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
                    }),
                );
            } catch (err) {
                logger.error("Error sending message:", err);
                setError("Failed to send message. Please retry.");
                return false;
            }
            setMessages(prev => {
                if (!prev) return [];
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
        } else if (audioToSend) {
            if (!chatId) {
                setError("Chat is still loading. Please wait.");
                setTyping("idle");
                return false;
            }
            const sentMessageId = Date.now();
            setMessages(prev => {
                if (!prev) return [];
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
            sendAndPlay(audioToSend, sentMessageId);
        } else {
            return false;
        }
        setInputAudio(undefined);
        setInputText('');
        scrollToBottom();
        return true;
    };

    const handleStartConversation = React.useCallback(async () => {
        const result = await startConversation();
        if (result?.errorStatus === 402) {
            setShowTopupModal(true);
        }
    }, [startConversation]);

    const handleCallModeChange = useCallback(async () => {
        if (mode === "call") {
            stopConversation();
            setMode("chat");
            return;
        }
        setMode("call");
    }, [mode, stopConversation]);

    const handleScrollEvent = () => {
        handleScroll(containerRef.current);
    };

    const handleSelect = useCallback((id: string) => {
        skipInfluencerResetRef.current = true;
        setSelectedId(id);
        setNeedsSelection(false);
    }, []);

    const handleChangeInfluencerClicked = async () => {
        setSelectedId(undefined);
        setNeedsSelection(true);
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
            setTyping("idle");
        } catch (err) {
            logger.error("Error clearing chat history", err);
        } finally {
            setIsClearingHistory(false);
        }
    };

    const isSelectingInfluencer = needsSelection && !selectedId;

    return (
        <div className={styles["container"]}>
            <div className={styles["chat-screen-content"]}>
                <div className={styles["chat-header"]}>
                    <UserNav
                        onMenuClick={onMenuClick}
                        title={isSelectingInfluencer ? "Select Influencer" : undefined}
                        onCallClick={(!isSelectingInfluencer && influencer) ? handleCallModeChange : undefined}
                        callMode={mode === "call"}
                        adultMode={adultModeSwitch}
                        onAdultModeChange={(!isSelectingInfluencer && influencer) ? handleAdultModeChange : undefined}
                        minutesRemaining={adultMinutesRemaining}
                    />
                </div>
                {isSelectingInfluencer ? (
                    <InfluencerSelector influencers={influencers} onItemClick={handleSelect} />
                ) : !influencer ? (
                    <div className={styles["empty-chat-screen"]}><TeaseMeLogo size='xlarge' variant='mono-lips-only' style={{ color: "hsla(0, 0%, 100%, 0.20)" }} /></div>
                ) : !showSubscriptionPage ? <>
                    {mode !== "call" ? <>
                        {isSuperUser && <ChatHeaderInfo
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
                            showChangeInfluencerButton={hasMultipleInfluencers}
                            onChangeInfluencer={handleChangeInfluencerClicked}
                            isSubscribed={hasSubscription}
                        />
                        <div
                            className={clsx(styles["chat-messages-container"], isLoadingMessages && styles["loading"])}
                            ref={containerRef}
                            onScroll={handleScrollEvent}
                        >
                            {(messages) ? <>
                                {isLoadingMore && <LoadingSpinner size='small' />}
                                <div className={styles.adultConvoCardArea}>
                                    {adultMode && !isLoadingMessages && <AdultConvoStarterCard influencerName={influencer?.name} />}
                                </div>
                                <MessagesList
                                    messages={displayMessages}
                                    typing={typing}
                                    messagesEndRef={messagesEndRef}
                                    containerRef={containerRef}
                                    influencerName={influencer?.name}
                                    showAudioTranscript={isSuperUser}
                                    isAudio={Boolean(inputAudio)}
                                    adultMode={adultMode}
                                    onAudioPlay={useCallback((src: string) => {
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
                                    }, [])}
                                    onCallBack={handleCallModeChange}
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
                                creditsRemaining={creditsRemaining}
                                inputAudio={inputAudio} />
                        </div>
                    </> : <CallModePage
                        cancelCall={cancelCall}
                        toggleMute={toggleMute}
                        status={status}
                        callTime={callTime}
                        micMute={micMuted}
                        startConversation={handleStartConversation}
                        stopConversation={stopConversation}
                        relationship={relationship}
                        influencer={influencer}
                        errorMessage={errorMessage || "Something went wrong!"}
                        onChangeInfluencer={hasMultipleInfluencers ? handleChangeInfluencerClicked : undefined} />
                    }
                </> : (
                    <AdultModePage
                        onSubscribePressed={handleSubscribePressed}
                        onBackClicked={() => {
                            setShowSubscriptionPage(false);
                            setAdultModeSwitch(false);
                        }}
                        influencerId={influencer?.id ?? ""}
                        influencerImageUrl={influencer?.img ?? null}
                        influencerName={influencer?.name ?? null}
                    />
                )}
            </div>
            <UpgradePlanModal
                isOpen={showUpgradeModal}
                onClose={() => setShowUpgradeModal(false)}
                onUpgrade={() => openSidebar("subscription", { influencerId: influencer?.id })}
            />

            <AddCreditsModal
                isOpen={showTopupModal}
                image={influencer?.img}
                onClose={() => setShowTopupModal(false)}
                influencerId={influencer?.id || ''} />

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
            <AdultTermsModal isOpen={showTermsModal} onClose={() => setShowTermsModal(false)} influencerId={influencer?.id || ''} onAgree={() => setShowTermsModal(false)} />

        </div>
    );
};

export default memo(ChatScreenContent);
