import React, {
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { AuthContext } from "@/context/AuthContext";
import styles from "./ChatScreenContent.module.css";
import MessagesList from "./MessageList";
import ChatInputArea from "./ChatInputArea";
import TeaseMeLogo from "@/ui/components/logos/TeaseMeLogo";
import { storage } from "@/utils/storage";
import { LocalStorageKeys } from "@/constants/localStorageKeys";
import LoadingSpinner from "@/ui/components/loading/LoadingSpinner";
import clsx from "clsx";
import logger from "@/utils/logger";
import useCallWebRTC from "@/hooks/useCallWebRTC";
import { useChatScroll } from "@/hooks/useChatScroll";
import IconButton from "@/ui/components/inputs/buttons/IconButton";
import { DropDownMenuDataModel } from "@/ui/components/inputs/dropdown/DropDownMenu";
import AdultModePage from "../pages/adult-mode/AdultModePage";
import UserNav from "@/ui/components/nav/UserNav";
import { Modal } from "@/ui/components/modals/Modal";
import NormalButton from "@/ui/components/inputs/buttons/NormalButton";
import SvgPack from "@/utils/SvgPack";
import ChatInfluencerBar from "./ChatInfluencerBar";
import ChatHeaderInfo from "./ChatHeaderInfo";
import CallModePage from "../pages/call-page/CallModePage";
import AdultConvoStarterCard from "@/ui/components/cards/AdultConvoStarterCard";
import { mergeCallMessages } from "./messageUtils";
import UpgradePlanModal from "@/ui/components/modals/subscription/UpgradePlanModal";
import AddCreditsModal from "@/ui/components/modals/payment-modal/AddCreditsModal";
import AdultTermsModal from "@/ui/components/modals/adult-terms/AdultTermsModal";
import { useSidebar } from "@/hooks/useSidebar";
import InfluencerSelector from "@/ui/screens/influencer/InfluencerSelector";
import { useInfluencerSelection } from "@/hooks/messaging/useInfluencerSelection";
import { useSubscriptionState } from "@/hooks/messaging/useSubscriptionState";
import { useChatRealtime } from "@/hooks/messaging/useChatRealtime";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  chatScreenActions,
  clearChatHistoryThunk,
  fetchChatUsage,
  fetchRelationshipForInfluencer,
  initializeChatSession,
  loadChatMessages,
  updateRelationshipFromText,
} from "@/store/chatScreenSlice";
import { showErrorModal } from "@/utils/errorModal";

interface ChatScreenContentProps {
  defaultInfluencerId?: string;
  onBackPressed?: () => void;
  menuItems?: DropDownMenuDataModel[];
  onMenuClick?: () => void;
  openSubscribe?: boolean;
}
const ChatScreenContent: React.FC<ChatScreenContentProps> = ({
  defaultInfluencerId,
  onMenuClick,
  openSubscribe,
}) => {
  const dispatch = useAppDispatch();

  const {
    chatId,
    messages,
    isLoadingMessages,
    inputText,
    typing,
    isWsConnected,
    error,
    pageNumber,
    hasMore,
    isLoadingMore,
    isClearingHistory,
    mode,
    relationship,
    creditsRemaining,
    adultMinutesRemaining,
    showUpgradeModal,
    showTopupModal,
    callTime,
  } = useAppSelector((state) => state.chatScreen);

  const [inputAudio, setInputAudio] = useState<Blob>();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastChatInitRef = useRef<string | null>(null);
  const localAudioUrlsRef = useRef<Set<string>>(new Set());

  const { user } = useContext(AuthContext);
  const { openSidebar } = useSidebar();

  const isSuperUser = user?.id === 1;

  const pageSize = 20;

  const {
    status,
    startConversation,
    stopConversation,
    setInfluencerId,
    micMuted,
    toggleMute,
    errorMessage,
    cancelCall,
  } = useCallWebRTC({
    onMessage: (message, conversationId) => {
      logger.debug(
        "Received WebRTC message on ChatScreenContent:",
        message,
        "conversationId:",
        conversationId,
      );
      if (message.source === "user") {
        logger.info("User message:", message.message);
        if (message.message) {
          dispatch(
            updateRelationshipFromText({
              userText: message.message,
              conversationId,
            }),
          );
        }
        if (influencer?.id) {
          dispatch(fetchRelationshipForInfluencer(influencer.id));
        }
      }
    },
  });

  const blockIfCallActive = useCallback(() => {
    const isCallActive = status === "connected" || status === "connecting";
    if (isCallActive) {
      showErrorModal({
        title: "Active Call in Progress",
        message: "End the call before navigating away.",
      });
      return true;
    }
    return false;
  }, [status]);

  const {
    influencer,
    influencers,
    hasMultipleInfluencers,
    isSelectingInfluencer,
    handleSelect,
    handleChangeInfluencerClicked,
  } = useInfluencerSelection(status, defaultInfluencerId);

  const {
    adultMode,
    adultModeSwitch,
    setAdultModeSwitch,
    hasSubscription,
    showSubscriptionPage,
    setShowSubscriptionPage,
    showTermsModal,
    setShowTermsModal,
    showErrorAlert,
    setShowErrorAlert,
    handleAdultModeChange,
    handleSubscribePressed,
  } = useSubscriptionState({ influencer, openSubscribe, callStatus: status });

  useEffect(() => {
    if (influencer?.id) {
      dispatch(chatScreenActions.setCurrentInfluencer(influencer));
    } else {
      dispatch(chatScreenActions.setCurrentInfluencer(undefined));
    }
  }, [dispatch, influencer]);

  const displayMessages = useMemo(
    () => (messages ? mergeCallMessages(messages) : []),
    [messages],
  );

  useEffect(() => {
    if (adultMode && mode === "call") {
      dispatch(chatScreenActions.setMode("chat"));
    }
  }, [adultMode, dispatch, mode]);

  useEffect(() => {
    storage.set(LocalStorageKeys.PreferredChatMode, mode);
  }, [mode]);

  useEffect(() => {
    if (!influencer?.id) {
      return;
    }
    dispatch(fetchChatUsage({ influencerId: influencer.id, adultMode }));
  }, [adultMode, dispatch, influencer?.id]);

  useEffect(() => {
    (async () => {
      if (influencer && user) {
        const initKey = `${user.id}-${influencer.id}-${adultMode}`;
        if (lastChatInitRef.current === initKey) {
          return;
        }
        lastChatInitRef.current = initKey;
        const chat_id = await dispatch(
          initializeChatSession({
            userId: user.id,
            influencerId: influencer.id,
            adultMode,
            pageSize,
          }),
        );
        connectChat(influencer.id, chat_id, adultMode);
        setInfluencerId(influencer.id);
        dispatch(chatScreenActions.setIsLoadingMore(false));
      }
    })();
  }, [adultMode, dispatch, influencer, setInfluencerId, user]);

  const { scrollToBottom, handleScroll } = useChatScroll({
    messagesEndRef: messagesEndRef,
    loadMore: async (container) => {
      if (
        container &&
        container.scrollTop === 0 &&
        hasMore &&
        !isLoadingMore &&
        chatId
      ) {
        dispatch(chatScreenActions.setIsLoadingMore(true));
        const previousScrollHeight = container.scrollHeight;
        await dispatch(
          loadChatMessages({
            chatId,
            page: pageNumber + 1,
            pageSize,
            adultMode,
          }),
        );
        dispatch(chatScreenActions.setPageNumber(pageNumber + 1));
        requestAnimationFrame(() => {
          if (containerRef.current) {
            const newScrollHeight = containerRef.current.scrollHeight;
            containerRef.current.scrollTop =
              newScrollHeight - previousScrollHeight;
          }
        });
        dispatch(chatScreenActions.setIsLoadingMore(false));
      }
    },
  });

  useEffect(() => {
    if (pageNumber === 1) {
      scrollToBottom();
    }
  }, [messages, pageNumber, scrollToBottom]);

  useEffect(() => {
    if (!messages) return;
    messages.forEach((message) => {
      message.attachments?.forEach((attachment) => {
        if (attachment.audioUrl?.startsWith("blob:")) {
          localAudioUrlsRef.current.add(attachment.audioUrl);
        }
      });
    });
  }, [messages]);

  useEffect(() => {
    return () => {
      localAudioUrlsRef.current.forEach((url) => {
        URL.revokeObjectURL(url);
      });
      localAudioUrlsRef.current.clear();
    };
  }, [adultMode, chatId, influencer?.id]);

  const { connectChat, sendMessage } = useChatRealtime({
    dispatch,
    chatId,
    mode,
    adultMode,
    influencerId: influencer?.id,
    inputText,
    inputAudio,
    isSuperUser,
    scrollToBottom,
    setInputAudio,
  });

  useEffect(() => {
    if (status === "connected") {
      dispatch(chatScreenActions.setCallTime(0));
      const interval = setInterval(() => {
        dispatch(chatScreenActions.incrementCallTime());
      }, 1000);

      return () => clearInterval(interval);
    } else {
      dispatch(chatScreenActions.setCallTime(0));
    }
  }, [dispatch, status]);

  const handleStartConversation = React.useCallback(async () => {
    const result = await startConversation();
    if (result?.errorStatus === 402) {
      dispatch(chatScreenActions.setShowTopupModal(true));
    }
  }, [dispatch, startConversation]);

  const handleCallModeChange = useCallback(async () => {
    if (blockIfCallActive()) return;
    if (mode === "call") {
      stopConversation();
      dispatch(chatScreenActions.setMode("chat"));
      return;
    }
    dispatch(chatScreenActions.setMode("call"));
  }, [mode, stopConversation]);

  const handleScrollEvent = () => {
    handleScroll(containerRef.current);
  };

  const handleAudioPlay = useCallback((src: string) => {
    if (currentAudioRef.current && currentAudioRef.current.src !== src) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
    }
    const audioEl = document.querySelector<HTMLAudioElement>(
      `audio[src="${src}"]`,
    );
    if (audioEl) {
      currentAudioRef.current = audioEl;
    }
  }, []);

  const handleClearHistory = async () => {
    if (!chatId || !isSuperUser) return;
    const confirmed = window.confirm(
      "Delete this chat history? This cannot be undone.",
    );
    if (!confirmed) return;

    await dispatch(clearChatHistoryThunk({ chatId, adultMode }));
  };

  const handleMenuClick = () => {
    if (blockIfCallActive()) return;
    onMenuClick?.();
  };

  return (
    <div className={styles["container"]}>
      <div className={styles["chat-screen-content"]}>
        <div className={styles["chat-header"]}>
          <UserNav
            onMenuClick={handleMenuClick}
            title={isSelectingInfluencer ? "Select Influencer" : undefined}
            onCallClick={
              !isSelectingInfluencer && influencer
                ? handleCallModeChange
                : undefined
            }
            callMode={mode === "call"}
            adultMode={adultModeSwitch}
            onAdultModeChange={
              !isSelectingInfluencer && influencer
                ? handleAdultModeChange
                : undefined
            }
            minutesRemaining={adultMinutesRemaining}
          />
        </div>
        {isSelectingInfluencer ? (
          <InfluencerSelector
            influencers={influencers}
            onItemClick={handleSelect}
          />
        ) : !influencer ? (
          <div className={styles["empty-chat-screen"]}>
            <TeaseMeLogo
              size="xlarge"
              variant="mono-lips-only"
              style={{ color: "hsla(0, 0%, 100%, 0.20)" }}
            />
          </div>
        ) : !showSubscriptionPage ? (
          <>
            {mode !== "call" ? (
              <>
                {isSuperUser && (
                  <ChatHeaderInfo
                    isSuperUser={isSuperUser}
                    chatId={chatId}
                    isClearingHistory={isClearingHistory}
                    onChangeInfluencer={handleChangeInfluencerClicked}
                    onClearHistory={handleClearHistory}
                  />
                )}
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
                  className={clsx(
                    styles["chat-messages-container"],
                    isLoadingMessages && styles["loading"],
                  )}
                  ref={containerRef}
                  onScroll={handleScrollEvent}
                >
                  {messages ? (
                    <>
                      {isLoadingMore && <LoadingSpinner size="small" />}
                      <div className={styles.adultConvoCardArea}>
                        {adultMode && !isLoadingMessages && (
                          <AdultConvoStarterCard
                            influencerName={influencer?.name}
                          />
                        )}
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
                        onAudioPlay={handleAudioPlay}
                        onCallBack={handleCallModeChange}
                      />
                    </>
                  ) : (
                    <LoadingSpinner />
                  )}
                </div>

                <div className={styles["chat-input-area"]}>
                  <ChatInputArea
                    adultMode={adultMode}
                    onSendMessage={sendMessage}
                    inputText={inputText}
                    setInputText={(text) =>
                      dispatch(chatScreenActions.setInputText(text))
                    }
                    setInputAudio={setInputAudio}
                    // disabled={error ? true : false}
                    error={error}
                    creditsRemaining={creditsRemaining}
                    inputAudio={inputAudio}
                  />
                </div>
              </>
            ) : (
              <CallModePage
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
                onChangeInfluencer={
                  hasMultipleInfluencers
                    ? handleChangeInfluencerClicked
                    : undefined
                }
              />
            )}
          </>
        ) : (
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
        onClose={() => dispatch(chatScreenActions.setShowUpgradeModal(false))}
        onUpgrade={() =>
          openSidebar("subscription", { influencerId: influencer?.id })
        }
      />

      <AddCreditsModal
        isOpen={showTopupModal}
        image={influencer?.img}
        onClose={() => dispatch(chatScreenActions.setShowTopupModal(false))}
        influencerId={influencer?.id || ""}
      />

      <Modal
        isOpen={!!showErrorAlert}
        onClose={() => {
          setShowErrorAlert(undefined);
        }}
        className={styles.cancelModal}
      >
        <div className={styles.modalCard}>
          <>
            <h3>Alert</h3>
            <p>{showErrorAlert}</p>
            <div className={styles.modalActions}>
              <NormalButton
                type="nobg"
                onClick={() => setShowErrorAlert(undefined)}
                text="Cancel"
              />
              <IconButton leftIcon={<SvgPack.Danger />} text={"Confirm"} />
            </div>
          </>
        </div>
      </Modal>
      <AdultTermsModal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        influencerId={influencer?.id || ""}
        onAgree={() => setShowTermsModal(false)}
      />
    </div>
  );
};

export default memo(ChatScreenContent);
