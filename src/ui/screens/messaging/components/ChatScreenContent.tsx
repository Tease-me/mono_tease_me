import React, { memo, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { Endpoints, WS_BASE_URL } from "@/api/urls";
import { AuthContext } from "@/context/AuthContext";
import styles from "./ChatScreenContent.module.css"
import { useParams } from 'react-router-dom';
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
    openSubscribe?: boolean;
}
export type TypingStatus = "idle" | "typing" | "recording";

const ChatScreenContent: React.FC<ChatScreenContentProps> = ({ id, onMenuClick, setNeedsSelection, showChangeInfluencerButton = false, openSubscribe }) => {
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
    const relationshipPollRef = useRef<number | null>(null);

    const { user } = useContext(AuthContext);
    const [adultMode, setAdultMode] = useState(false);
    const adultModeRef = useRef(false);
    useEffect(() => { adultModeRef.current = adultMode; }, [adultMode]);
    const [adultModeSwitch, setAdultModeSwitch] = useState(false);
    const [mode, setMode] = useState<"chat" | "call">(storage.get(LocalStorageKeys.PreferredChatMode) === "call" ? "call" : "chat");
    const [showSubscriptionPage, setShowSubscriptionPage] = useState(false);
    const [showErrorAlert, setShowErrorAlert] = useState<string | undefined>();
    const [relationship, setRelationship] = useState<RelationshipDataModel | undefined>();
    const [creditsRemaining, setCreditsRemaining] = useState<number | undefined>(undefined);
    const [adultMinutesRemaining, setAdultMinutesRemaining] = useState<number | undefined>(undefined);

    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [showTopupModal, setShowTopupModal] = useState(false);

    const [showTermsModal, setShowTermsModal] = useState(false);

    const { user_id } = useParams();

    const isSuperUser = user?.id === 1;

    const pageSize = 20;

    const { status, startConversation, stopConversation, setInfluencerId, timeRemaining, micMuted, toggleMute, errorMessage } = useCallWebRTC();
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
            if (!id) {
                if (!user_id) {
                    setInfluencer(undefined);
                    return;
                }
                const localInfluencer = await influencerRepo.getInfluencer(user_id);
                setInfluencer(localInfluencer);
            } else {
                const localInfluencer = await influencerRepo.getInfluencer(id);
                setInfluencer(localInfluencer);
            }
        })()
    }, [id, user_id]);

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
                const chat_id = await (adultMode ? adultChatRepo.getChatId(user.id, influencer.id) : chatRepository.getChatId(user.id, influencer.id));
                setChatId(chat_id);
                setPageNumber(1);
                setHasMore(true);
                await fetchMessages(chat_id, 1);
                connectChat(influencer.id);
                setInfluencerId(influencer.id);
                relationshipServices.getRelationship(influencer.id).then((relationshipResponse) => {
                    setRelationship(relationshipResponse)
                })
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
                    if (adultMode) {
                        setShowUpgradeModal(true);
                    } else {
                        setShowTopupModal(true);
                    }
                }
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

    async function sendAndPlay(audioBlob: Blob, sentMessageId?: number) {
        if (!influencer) return;
        if (!chatId) return;

        const { audio_url, transcript, ai_text } = await (adultMode ? adultChatRepo : chatRepository).sendAudioMessage(audioBlob, influencer.id, chatId);

        setTyping("idle");
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
            setTyping("recording");
            const sentMessageId = Date.now();
            sendAndPlay(audioToSend, sentMessageId);
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
        } else {
            return false;
        }
        setInputAudio(undefined);
        setInputText('');
        scrollToBottom();
        return true;
    };

    const handleCallModeChange = () => {
        setMode(prev => {
            if (prev === "call") return "chat";
            return "call";
        })
    }

    const handleScrollEvent = () => {
        handleScroll(containerRef.current);
    };

    const handleChangeInfluencerClicked = async () => {
        setNeedsSelection?.(true)
    };

    useEffect(() => {
        if (relationshipPollRef.current) {
            window.clearInterval(relationshipPollRef.current);
            relationshipPollRef.current = null;
        }

        if (status === "connected" && influencer?.id) {
            const fetchRelationship = () => {
                relationshipServices.getRelationship(influencer.id).then((relationship) => {
                    setRelationship(relationship);
                }).catch((err) => logger.error("Error refreshing relationship", err));
            };

            fetchRelationship();
            relationshipPollRef.current = window.setInterval(fetchRelationship, 5000);
        }

        return () => {
            if (relationshipPollRef.current) {
                window.clearInterval(relationshipPollRef.current);
                relationshipPollRef.current = null;
            }
        };
    }, [status, influencer?.id]);

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

    if (!influencer) return <div className={styles["empty-chat-screen"]}><TeaseMeLogo size='xlarge' variant='mono-lips-only' style={{ color: "hsla(0, 0%, 100%, 0.20)" }} /></div>;

    return (
        <div className={styles["container"]}>
            <div className={styles["chat-screen-content"]}>
                <div className={styles["chat-header"]}>
                    <UserNav
                        onMenuClick={onMenuClick}
                        onCallClick={handleCallModeChange}
                        callMode={mode === "call"}
                        adultMode={adultModeSwitch}
                        onAdultModeChange={handleAdultModeChange}
                        minutesRemaining={adultMinutesRemaining}
                    />
                </div>
                {!showSubscriptionPage ? <>
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
                            showChangeInfluencerButton={showChangeInfluencerButton}
                            onChangeInfluencer={handleChangeInfluencerClicked}
                        />
                        <div
                            className={clsx(styles["chat-messages-container"], isLoadingMessages && styles["loading"])}
                            ref={containerRef}
                            onScroll={handleScrollEvent}
                        >
                            {(messages) ? <>
                                {isLoadingMore && <LoadingSpinner size='small' />}
                                <div className={styles.adultConvoCardArea}>
                                    {adultMode && <AdultConvoStarterCard influencerName={influencer?.name} />}
                                </div>
                                <MessagesList
                                    messages={displayMessages}
                                    typing={typing}
                                    messagesEndRef={messagesEndRef}
                                    containerRef={containerRef}
                                    influencerName={influencer?.name}
                                    showAudioTranscript={isSuperUser}
                                    isAudio={Boolean(inputAudio)}
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
                                creditsRemaining={creditsRemaining}
                                inputAudio={inputAudio} />
                        </div>
                    </> : <CallModePage
                        toggleMute={toggleMute}
                        status={status}
                        timeRemaining={timeRemaining}
                        micMute={micMuted}
                        startConversation={startConversation}
                        stopConversation={stopConversation}
                        relationship={relationship}
                        influencer={influencer}
                        errorMessage={errorMessage || "Something went wrong!"} />
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
            />

            <AddCreditsModal
                isOpen={showTopupModal}
                image={influencer?.img || ''}
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
