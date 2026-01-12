import useMediaQuery from "@/hooks/useMediaQuery";
import { constants } from "../constants";


// Shared helper to detect desktop breakpoint.
export default function useIsDesktop() {
  return useMediaQuery(`(min-width: ${constants.DESKTOP_BREAKPOINT}px)`);
}
