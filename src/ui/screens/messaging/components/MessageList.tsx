import React, { useEffect } from "react";

import styles from "./MessageList.module.css";
import MessageBubble, { CallMessageGroup } from "./MessageBubble";
import { Message } from "@/data/models/MessageDataModel";
import { TypingStatus } from "@/store/chatScreenSlice";

export type DisplayMessage = Message | CallMessageGroup;

const isCallGroup = (message: DisplayMessage): message is CallMessageGroup => {
  return (message as CallMessageGroup).type === "call-group";
};

interface MessagesListProps {
  messages: DisplayMessage[];
  typing: TypingStatus;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  containerRef?: React.RefObject<HTMLDivElement | null>;
  influencerName?: string;
  onAudioPlay?: (src: string) => void;
  showAudioTranscript?: boolean;
  isAudio?: boolean;
  onCallBack?: () => void;
  adultMode?: boolean;
}

const MessagesList = React.memo(
  ({
    messages,
    typing,
    messagesEndRef,
    containerRef,
    influencerName,
    onAudioPlay,
    showAudioTranscript,
    onCallBack,
    adultMode = false,
  }: MessagesListProps) => {
    useEffect(() => {
      const container = containerRef?.current;
      if (!container) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        return;
      }
      const distanceFromBottom =
        container.scrollHeight - (container.scrollTop + container.clientHeight);
      const shouldAutoScroll = distanceFromBottom < 120;
      if (shouldAutoScroll) {
        container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
      }
    }, [messages.length, typing, messagesEndRef, containerRef]);

    return (
      <>
        <div className={styles["messages"]}>
          {messages.length === 0 && typing === "idle" && !adultMode && (
            <div className={styles["empty-card"]}>
              <div className={styles["empty-title"]}>No messages yet</div>
              <div className={styles["empty-subtitle"]}>
                Send a message to start the conversation.
              </div>
            </div>
          )}
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              msg={!isCallGroup(msg) ? msg : undefined}
              callGroup={isCallGroup(msg) ? msg : undefined}
              influencerName={influencerName}
              onAudioPlay={onAudioPlay}
              showAudioTranscript={showAudioTranscript}
              onCallBack={onCallBack}
            />
          ))}

          {typing !== "idle" && (
            <MessageBubble isAudio={typing === "recording"} />
          )}
        </div>
        <div ref={messagesEndRef} style={{ height: "50px" }} />
      </>
    );
  },
);

export default MessagesList;
