import { useCallback } from "react";

type UseChatScrollParams = {
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  loadMore: (container: HTMLDivElement | null) => void | Promise<void>;
};

export function useChatScroll({ messagesEndRef, loadMore }: UseChatScrollParams) {
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesEndRef]);

  const handleScroll = useCallback((container: HTMLDivElement | null) => {
    loadMore(container);
  }, [loadMore]);

  return { scrollToBottom, handleScroll };
}
