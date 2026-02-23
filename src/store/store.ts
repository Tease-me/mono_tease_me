import { configureStore } from "@reduxjs/toolkit";
import chatScreenReducer from "./chatScreenSlice";
import subscriptionReducer from "./subscriptionSlice";

export const store = configureStore({
  reducer: {
    chatScreen: chatScreenReducer,
    subscription: subscriptionReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
