import { isStaleChunkError, tryReloadForStaleChunk } from "@/utils/chunkReload";
import { JSX, useEffect } from "react";

type StaleChunkErrorFallbackProps = {
  error: unknown;
  fallback: JSX.Element;
};

export default function StaleChunkErrorFallback({
  error,
  fallback,
}: StaleChunkErrorFallbackProps) {
  useEffect(() => {
    tryReloadForStaleChunk(error, "react-error-boundary");
  }, [error]);

  if (isStaleChunkError(error)) {
    return null;
  }

  return fallback;
}
