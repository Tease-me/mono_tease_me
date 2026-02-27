import useMediaQuery from "@/hooks/useMediaQuery";
import { constants } from "@/utils/constants";

const useIsDesktop = () =>
  useMediaQuery(`(min-width: ${constants.DESKTOP_TABLET_BREAKPOINT}px)`);

export const useIsTablet = () =>
  useMediaQuery(
    `(min-width: ${constants.DESKTOP_TABLET_BREAKPOINT}px) and (max-width: ${constants.DESKTOP_BREAKPOINT - 1}px)`
  );

export const useIsDesktopOnly = () =>
  useMediaQuery(`(min-width: ${constants.DESKTOP_BREAKPOINT}px)`);

export const useIsMobile = () =>
  useMediaQuery(`(max-width: ${constants.DESKTOP_TABLET_BREAKPOINT - 1}px)`);

export default useIsDesktop;
