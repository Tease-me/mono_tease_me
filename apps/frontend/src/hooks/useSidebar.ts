import { createContext, useContext } from "react";

type SidebarContextType = {
  openSidebar: (pageId: string, payload?: Record<string, any>) => void;
};

export const SidebarContext = createContext<SidebarContextType>({
  openSidebar: () => {},
});

export function useSidebar() {
  return useContext(SidebarContext);
}
