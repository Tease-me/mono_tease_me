import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { Message } from "@/data/models/MessageDataModel";
import type { RelationshipDataModel } from "@/data/models/RelationshipDataModel";
import type { InfluencerDataModel } from "@/data/models/InfluencerDataModel";
import { UserServices } from "@/api/services/UserServices";
import { apiClient } from "@/api/apis";
import { secondsToMinutes } from "@/utils/DateTimeUtils";
import logger from "@/utils/logger";
import type { AppDispatch } from "./store";
import { LocalStorageKeys } from "@/constants/localStorageKeys";
import { ChatRepository } from "@/data/repositories/ChatRepo";
import { AdultChatRepo } from "@/data/repositories/AdultChatRepo";
import { RelationshipServices } from "@/api/services/RelationshipServices";
import { InfluencerServices } from "@/api/services/InfluencerService";
import type { MessagePagination } from "@/data/models/MessageDataModel";

export type TypingStatus = "idle" | "typing" | "recording";
export type ChatMode = "chat" | "call";

type UsagePayload = {
  influencerId?: string;
  adultMode: boolean;
};

type LoadMessagesPayload = {
  chatId: string;
  page: number;
  pageSize: number;
  adultMode: boolean;
};

type InitChatPayload = {
  userId: number;
  influencerId: string;
  adultMode: boolean;
  pageSize: number;
};

type ClearHistoryPayload = {
  chatId: string;
  adultMode: boolean;
};

interface ChatScreenState {
  chatId?: string;
  messages: Message[];
  isLoadingMessages: boolean;
  inputText: string;
  typing: TypingStatus;
  isWsConnected: boolean;
  error?: string;
  pageNumber: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  isClearingHistory: boolean;
  mode: ChatMode;
  relationship?: RelationshipDataModel;
  creditsRemaining?: number;
  adultMinutesRemaining?: number;
  showUpgradeModal: boolean;
  showTopupModal: boolean;
  callTime: number;
  currentInfluencerId?: string;
  influencerById: Record<string, InfluencerDataModel>;
}

const getInitialMode = (): ChatMode => {
  if (typeof window === "undefined") {
    return "call";
  }
  const raw = localStorage.getItem(LocalStorageKeys.PreferredChatMode);
  return raw === "chat" ? "chat" : "call";
};

const initialState: ChatScreenState = {
  chatId: undefined,
  messages: [],
  isLoadingMessages: false,
  inputText: "",
  typing: "idle",
  isWsConnected: false,
  error: undefined,
  pageNumber: 1,
  hasMore: true,
  isLoadingMore: false,
  isClearingHistory: false,
  mode: getInitialMode(),
  relationship: undefined,
  creditsRemaining: undefined,
  adultMinutesRemaining: undefined,
  showUpgradeModal: false,
  showTopupModal: false,
  callTime: 0,
  currentInfluencerId: undefined,
  influencerById: {},
};

const chatRepository = ChatRepository();
const adultChatRepo = AdultChatRepo();
const relationshipServices = RelationshipServices(apiClient);
const influencerServices = InfluencerServices(apiClient);

const chatScreenSlice = createSlice({
  name: "chatScreen",
  initialState,
  reducers: {
    setChatId(state, action: PayloadAction<string | undefined>) {
      state.chatId = action.payload;
    },
    setMessages(state, action: PayloadAction<Message[]>) {
      state.messages = action.payload;
    },
    prependMessages(state, action: PayloadAction<Message[]>) {
      state.messages = [...action.payload, ...state.messages];
    },
    appendMessage(state, action: PayloadAction<Message>) {
      state.messages.push(action.payload);
    },
    updateMessageTranscript(
      state,
      action: PayloadAction<{ id: number; transcript?: string }>
    ) {
      state.messages = state.messages.map((message) =>
        message.id === action.payload.id
          ? { ...message, transcript: action.payload.transcript ?? message.transcript }
          : message
      );
    },
    setIsLoadingMessages(state, action: PayloadAction<boolean>) {
      state.isLoadingMessages = action.payload;
    },
    setInputText(state, action: PayloadAction<string>) {
      state.inputText = action.payload;
    },
    setTyping(state, action: PayloadAction<TypingStatus>) {
      state.typing = action.payload;
    },
    setIsWsConnected(state, action: PayloadAction<boolean>) {
      state.isWsConnected = action.payload;
    },
    setError(state, action: PayloadAction<string | undefined>) {
      state.error = action.payload;
    },
    setPageNumber(state, action: PayloadAction<number>) {
      state.pageNumber = action.payload;
    },
    setHasMore(state, action: PayloadAction<boolean>) {
      state.hasMore = action.payload;
    },
    setIsLoadingMore(state, action: PayloadAction<boolean>) {
      state.isLoadingMore = action.payload;
    },
    setIsClearingHistory(state, action: PayloadAction<boolean>) {
      state.isClearingHistory = action.payload;
    },
    setMode(state, action: PayloadAction<ChatMode>) {
      state.mode = action.payload;
    },
    setRelationship(state, action: PayloadAction<RelationshipDataModel | undefined>) {
      state.relationship = action.payload;
    },
    setCreditsRemaining(state, action: PayloadAction<number | undefined>) {
      state.creditsRemaining = action.payload;
    },
    setAdultMinutesRemaining(state, action: PayloadAction<number | undefined>) {
      state.adultMinutesRemaining = action.payload;
    },
    setShowUpgradeModal(state, action: PayloadAction<boolean>) {
      state.showUpgradeModal = action.payload;
    },
    setShowTopupModal(state, action: PayloadAction<boolean>) {
      state.showTopupModal = action.payload;
    },
    setCallTime(state, action: PayloadAction<number>) {
      state.callTime = action.payload;
    },
    incrementCallTime(state) {
      state.callTime += 1;
    },
    setCurrentInfluencer(
      state,
      action: PayloadAction<InfluencerDataModel | undefined>
    ) {
      state.currentInfluencerId = action.payload?.id;
      if (action.payload?.id) {
        state.influencerById[action.payload.id] = action.payload;
      }
    },
    resetChatSession(state) {
      state.messages = [];
      state.chatId = undefined;
      state.pageNumber = 1;
      state.hasMore = true;
      state.isLoadingMore = false;
      state.isLoadingMessages = false;
      state.typing = "idle";
      state.error = undefined;
      state.relationship = undefined;
    },
    setUsageFromData(
      state,
      action: PayloadAction<{ usage: any; adultMode: boolean }>
    ) {
      const { usage, adultMode } = action.payload;
      state.creditsRemaining = adultMode
        ? usage?.adult?.messages?.remaining
        : usage?.normal?.messages?.remaining;
      const voiceSeconds = usage?.adult?.voice_seconds?.remaining;
      const fallbackMinutes =
        usage?.adult?.live_chat?.remaining_minutes ?? usage?.adult?.voice?.remaining_minutes;
      state.adultMinutesRemaining =
        voiceSeconds != null ? secondsToMinutes(voiceSeconds) : fallbackMinutes;
    },
  },
});

export const chatScreenActions = chatScreenSlice.actions;

export const fetchChatUsage =
  ({ influencerId, adultMode }: UsagePayload) =>
    async (dispatch: AppDispatch) => {
      try {
        const usage = await UserServices(apiClient).getUserUsage(influencerId);
        dispatch(chatScreenActions.setUsageFromData({ usage, adultMode }));
      } catch (err) {
        logger.error("Error fetching user usage:", err);
      }
    };

export const fetchRelationshipForInfluencer =
  (influencerId: string, isInitial: boolean = false) => async (dispatch: AppDispatch) => {
    try {
      const relationship = await relationshipServices.getRelationship(influencerId);
      if (isInitial) {
        dispatch(
          chatScreenActions.setRelationship({ ...relationship, sentiment_delta: 0 })
        )
      }
      else {
        dispatch(chatScreenActions.setRelationship(relationship));
      }
    } catch (err) {
      logger.error("Error refreshing relationship", err);
    }
  };

export const updateRelationshipFromText =
  ({ userText, conversationId }: { userText: string | null; conversationId: string | null }) =>
    async (dispatch: AppDispatch) => {
      try {
        const data = await influencerServices.relationship_update(userText, conversationId);
        if (data?.relationship) {
          dispatch(chatScreenActions.setRelationship(data.relationship));
        }
      } catch (err) {
        logger.error(err);
      }
    };

export const loadChatMessages =
  ({ chatId, page, pageSize, adultMode }: LoadMessagesPayload) =>
    async (dispatch: AppDispatch) => {
      try {
        if (page === 1) {
          dispatch(chatScreenActions.setIsLoadingMessages(true));
        }

        const responseMessagesPagination: MessagePagination = await (
          adultMode ? adultChatRepo.getChatHistory(chatId, page, pageSize) : chatRepository.getChatHistory(chatId, page, pageSize)
        );
        const totalPages = Math.ceil(responseMessagesPagination.total / pageSize);
        const localMessages = responseMessagesPagination.messages ?? [];

        if (page === 1) {
          dispatch(chatScreenActions.setMessages(localMessages));
        } else {
          dispatch(chatScreenActions.prependMessages(localMessages));
        }
        dispatch(chatScreenActions.setHasMore(page < totalPages));
        return { chatId, totalPages };
      } catch (err) {
        logger.error("Error loading messages", err);
        if (page === 1) {
          dispatch(chatScreenActions.setMessages([]));
          dispatch(chatScreenActions.setHasMore(false));
        }
        return undefined;
      } finally {
        if (page === 1) {
          dispatch(chatScreenActions.setIsLoadingMessages(false));
        }
      }
    };

export const initializeChatSession =
  ({ userId, influencerId, adultMode, pageSize }: InitChatPayload) =>
    async (dispatch: AppDispatch) => {
      dispatch(chatScreenActions.resetChatSession());

      const chatId = await (
        adultMode ? adultChatRepo.getChatId(userId, influencerId) : chatRepository.getChatId(userId, influencerId)
      );
      dispatch(chatScreenActions.setChatId(chatId));
      dispatch(chatScreenActions.setPageNumber(1));
      dispatch(chatScreenActions.setHasMore(true));
      dispatch(chatScreenActions.setIsLoadingMore(false));
      await dispatch(loadChatMessages({ chatId, page: 1, pageSize, adultMode }));
      await dispatch(fetchRelationshipForInfluencer(influencerId, true));
      return chatId;
    };

export const clearChatHistoryThunk =
  ({ chatId, adultMode }: ClearHistoryPayload) =>
    async (dispatch: AppDispatch) => {
      dispatch(chatScreenActions.setIsClearingHistory(true));
      try {
        await chatRepository.clearChatHistory(chatId, adultMode);
        dispatch(chatScreenActions.setMessages([]));
        dispatch(chatScreenActions.setHasMore(false));
        dispatch(chatScreenActions.setPageNumber(1));
        dispatch(chatScreenActions.setTyping("idle"));
      } catch (err) {
        logger.error("Error clearing chat history", err);
      } finally {
        dispatch(chatScreenActions.setIsClearingHistory(false));
      }
    };

export default chatScreenSlice.reducer;
