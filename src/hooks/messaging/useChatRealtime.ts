import { useCallback, useEffect, useRef } from "react";
import { Endpoints, WS_BASE_URL } from "@/api/urls";
import { storage } from "@/utils/storage";
import { LocalStorageKeys } from "@/constants/localStorageKeys";
import { ChatRepository } from "@/data/repositories/ChatRepo";
import { AdultChatRepo } from "@/data/repositories/AdultChatRepo";
import logger from "@/utils/logger";
import { chatScreenActions, fetchChatUsage } from "@/store/chatScreenSlice";
import type { AppDispatch } from "@/store/store";
import { apiClient } from "@/api/apis";
import { AuthServices } from "@/api/services/AuthServices";

const chatRepository = ChatRepository();
const adultChatRepo = AdultChatRepo();

type UseChatRealtimeParams = {
  dispatch: AppDispatch;
  chatId?: string;
  mode: "chat" | "call";
  adultMode: boolean;
  influencerId?: string;
  inputText: string;
  inputAudio?: Blob;
  isSuperUser: boolean;
  scrollToBottom: () => void;
  setInputAudio: (blob?: Blob) => void;
};

const calculateReplyTime = (msg: string) => msg.length * 50;

export function useChatRealtime({
  dispatch,
  chatId,
  mode,
  adultMode,
  influencerId,
  inputText,
  inputAudio,
  isSuperUser,
  scrollToBottom,
  setInputAudio,
}: UseChatRealtimeParams) {
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<number | null>(null);
  const manualCloseRef = useRef(false);
  const chatIdRef = useRef(chatId);
  const modeRef = useRef(mode);
  const adultModeRef = useRef(adultMode);
  const influencerIdRef = useRef(influencerId);

  useEffect(() => {
    chatIdRef.current = chatId;
  }, [chatId]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    adultModeRef.current = adultMode;
  }, [adultMode]);

  useEffect(() => {
    influencerIdRef.current = influencerId;
  }, [influencerId]);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimer.current) {
      window.clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
  }, []);

  const connectChat = useCallback(
    (
      targetInfluencerId: string,
      activeChatId = chatIdRef.current,
      activeMode = adultModeRef.current,
    ) => {
      if (ws.current) {
        manualCloseRef.current = true;
        ws.current.close();
      }

      const authServices = AuthServices(apiClient);

      // Refresh token before connecting to avoid expired-token errors
      const refreshAndConnect = async () => {
        let accessToken = storage.get(LocalStorageKeys.AccessToken);
        try {
          const refreshToken = storage.get(LocalStorageKeys.RefreshToken);
          if (refreshToken) {
            const tokens = await authServices.refreshToken(refreshToken);
            storage.set(LocalStorageKeys.AccessToken, tokens.access_token);
            storage.set(LocalStorageKeys.RefreshToken, tokens.refresh_token);
            accessToken = tokens.access_token;
          }
        } catch (err) {
          logger.warn("Token refresh before WS connect failed, using existing token", err);
        }

        if (!accessToken) {
          dispatch(chatScreenActions.setError("Not authenticated. Please log in."));
          return;
        }

        ws.current = new window.WebSocket(
          `${WS_BASE_URL}${activeMode ? Endpoints.ws.chat18 : Endpoints.ws.chat}/${targetInfluencerId}?token=${accessToken}`,
        );

        const connectionChatId = activeChatId;
        const connectionAdultMode = activeMode;

        const scheduleReconnect = (refreshFirst = false) => {
          if (modeRef.current !== "chat") return;
          if (reconnectTimer.current) return;
          reconnectTimer.current = window.setTimeout(() => {
            reconnectTimer.current = null;
            if (modeRef.current !== "chat") return;
            const latestInfluencerId =
              influencerIdRef.current ?? targetInfluencerId;
            connectChat(
              latestInfluencerId,
              chatIdRef.current,
              adultModeRef.current,
            );
          }, refreshFirst ? 1000 : 5000);
        };

        ws.current.onopen = () => {
          dispatch(chatScreenActions.setIsWsConnected(true));
          dispatch(chatScreenActions.setError(undefined));
          clearReconnectTimer();
        };
        ws.current.onclose = (event) => {
          if (manualCloseRef.current) {
            manualCloseRef.current = false;
            return;
          }
          dispatch(chatScreenActions.setIsWsConnected(false));

          // 4401 = token expired — refresh and reconnect quickly
          if (event.code === 4401) {
            dispatch(chatScreenActions.setError("Session expired. Reconnecting..."));
            scheduleReconnect(true);
            return;
          }

          // 4002 = generic auth error — don't reconnect
          if (event.code === 4002) {
            dispatch(chatScreenActions.setError("Authentication failed. Please log in again."));
            return;
          }

          dispatch(chatScreenActions.setError("Disconnected. Reconnecting..."));
          scheduleReconnect();
        };
        ws.current.onerror = () => {
          dispatch(chatScreenActions.setIsWsConnected(false));
          dispatch(
            chatScreenActions.setError("Connection error. Reconnecting..."),
          );
          scheduleReconnect();
        };
        ws.current.onmessage = (event) => {
          dispatch(chatScreenActions.setTyping("idle"));
          const data = JSON.parse(event.data);
          if (data.reply) {
            dispatch(chatScreenActions.setTyping("typing"));
            if (data.usage) {
              dispatch(
                chatScreenActions.setUsageFromData({
                  usage: data.usage,
                  adultMode: adultModeRef.current,
                }),
              );
            }

            window.setTimeout(() => {
              if (
                chatIdRef.current !== connectionChatId ||
                adultModeRef.current !== connectionAdultMode
              ) {
                return;
              }

              dispatch(
                chatScreenActions.appendMessage({
                  id: Date.now(),
                  sender: "received",
                  text: data.reply,
                  channel: data.channel ?? "chat",
                  time: new Date().toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                  timestamp: Date.now(),
                }),
              );
              dispatch(chatScreenActions.setTyping("idle"));
              dispatch(chatScreenActions.setError(undefined));
              if (data.relationship) {
                dispatch(chatScreenActions.setRelationship(data.relationship));
              }
              scrollToBottom();
            }, calculateReplyTime(data.reply));
            return;
          }

          if (data.error) {
            dispatch(chatScreenActions.setTyping("idle"));
            logger.error("Error in WebSocket message:", data.error);
            if (data.error === "INSUFFICIENT_CREDITS") {
              dispatch(
                chatScreenActions.setError(
                  "Insufficient credits to send message.",
                ),
              );
              if (adultModeRef.current) {
                dispatch(chatScreenActions.setShowUpgradeModal(true));
              } else {
                dispatch(chatScreenActions.setShowTopupModal(true));
              }
            } else if (typeof data.error === "string") {
              dispatch(chatScreenActions.setError(data.error));
            } else {
              dispatch(
                chatScreenActions.setError(
                  "An error occurred while sending the message.",
                ),
              );
            }
          }
        };
      };

      refreshAndConnect();
    },
    [clearReconnectTimer, dispatch, scrollToBottom],
  );

  useEffect(() => {
    if (!influencerIdRef.current) return;

    if (mode === "call") {
      clearReconnectTimer();
      if (ws.current) {
        manualCloseRef.current = true;
        ws.current.close();
      }
      dispatch(chatScreenActions.setIsWsConnected(false));
      dispatch(chatScreenActions.setError(undefined));
      return;
    }

    if (mode === "chat" && chatIdRef.current) {
      connectChat(
        influencerIdRef.current,
        chatIdRef.current,
        adultModeRef.current,
      );
    }
  }, [clearReconnectTimer, connectChat, dispatch, mode]);

  useEffect(() => {
    return () => {
      clearReconnectTimer();
      if (ws.current) {
        manualCloseRef.current = true;
        ws.current.close();
      }
    };
  }, [clearReconnectTimer]);

  const sendAndPlay = useCallback(
    async (audioBlob: Blob, sentMessageId?: number) => {
      if (!influencerIdRef.current) return;
      if (!chatIdRef.current) return;

      const capturedMode = adultModeRef.current;
      const capturedChatId = chatIdRef.current;
      const currentInfluencerId = influencerIdRef.current;

      try {
        const { audio_url, transcript, ai_text } = await (
          capturedMode ? adultChatRepo : chatRepository
        ).sendAudioMessage(audioBlob, currentInfluencerId, capturedChatId);

        if (
          adultModeRef.current !== capturedMode ||
          chatIdRef.current !== capturedChatId
        ) {
          return;
        }

        if (influencerId) {
          dispatch(fetchChatUsage({ influencerId, adultMode }));
        }

        dispatch(chatScreenActions.setTyping("recording"));
        window.setTimeout(() => {
          if (
            adultModeRef.current !== capturedMode ||
            chatIdRef.current !== capturedChatId
          ) {
            return;
          }

          if (sentMessageId && isSuperUser) {
            dispatch(
              chatScreenActions.updateMessageTranscript({
                id: sentMessageId,
                transcript: transcript,
              }),
            );
          }
          dispatch(
            chatScreenActions.appendMessage({
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
            }),
          );
          dispatch(chatScreenActions.setTyping("idle"));
          scrollToBottom();
        }, 5000);
      } catch (err: any) {
        dispatch(chatScreenActions.setTyping("idle"));
        if (err?.response?.status === 402) {
          dispatch(
            chatScreenActions.setError(
              "Insufficient credits to send voice message.",
            ),
          );
          dispatch(chatScreenActions.setShowUpgradeModal(true));
        } else {
          dispatch(chatScreenActions.setError("Failed to send voice message."));
        }
        logger.error("Error sending voice message:", err);
      }
    },
    [dispatch, isSuperUser, scrollToBottom],
  );

  const sendMessage = useCallback(
    (forcedAudio?: Blob): boolean => {
      if (!influencerIdRef.current) return false;
      const audioToSend = forcedAudio ?? inputAudio;

      if (inputText.trim()) {
        if (!chatIdRef.current) {
          dispatch(
            chatScreenActions.setError("Chat is still loading. Please wait."),
          );
          dispatch(chatScreenActions.setTyping("idle"));
          return false;
        }
        const socket = ws.current;
        if (!socket || socket.readyState !== WebSocket.OPEN) {
          dispatch(
            chatScreenActions.setError("Not connected. Reconnecting..."),
          );
          dispatch(chatScreenActions.setTyping("idle"));
          return false;
        }
        dispatch(chatScreenActions.setTyping("idle"));
        try {
          socket.send(
            JSON.stringify({
              chat_id: chatIdRef.current,
              message: inputText.trim(),
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            }),
          );
        } catch (err) {
          logger.error("Error sending message:", err);
          dispatch(
            chatScreenActions.setError("Failed to send message. Please retry."),
          );
          return false;
        }
        dispatch(
          chatScreenActions.appendMessage({
            id: Date.now(),
            sender: "sent",
            channel: "chat",
            text: inputText,
            time: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            timestamp: Date.now(),
          }),
        );
      } else if (audioToSend) {
        if (!chatIdRef.current) {
          dispatch(
            chatScreenActions.setError("Chat is still loading. Please wait."),
          );
          dispatch(chatScreenActions.setTyping("idle"));
          return false;
        }
        const sentMessageId = Date.now();
        const localAudioUrl = URL.createObjectURL(audioToSend);
        dispatch(
          chatScreenActions.appendMessage({
            id: sentMessageId,
            sender: "sent",
            channel: "chat",
            time: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            timestamp: Date.now(),
            attachments: [
              {
                audioUrl: localAudioUrl,
                type: "audio",
              },
            ],
          }),
        );
        void sendAndPlay(audioToSend, sentMessageId);
      } else {
        return false;
      }

      setInputAudio(undefined);
      dispatch(chatScreenActions.setInputText(""));
      scrollToBottom();
      return true;
    },
    [
      dispatch,
      inputAudio,
      inputText,
      scrollToBottom,
      sendAndPlay,
      setInputAudio,
    ],
  );

  return {
    connectChat,
    sendMessage,
  };
}
