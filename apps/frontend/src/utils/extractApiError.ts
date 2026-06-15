export function extractApiError(
  err: unknown,
  fallback = "Something went wrong",
): string {
  const response = (err as { response?: { data?: { detail?: unknown; message?: string } } })
    ?.response;
  const detail = response?.data?.detail;

  if (typeof response?.data?.message === "string" && response.data.message.trim()) {
    return response.data.message;
  }
  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) =>
        typeof item === "object" && item && "msg" in item
          ? String(item.msg)
          : String(item),
      )
      .filter(Boolean);
    if (messages.length) return messages.join(", ");
  }

  const message = (err as { message?: string })?.message;
  if (message && message !== "Network Error") {
    return message;
  }

  if (!response) {
    return "Could not reach the server. Check that the backend is running.";
  }

  return fallback;
}
