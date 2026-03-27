# Adult Browser Voice Frontend Integration

This document describes how the frontend should integrate with the backend-managed adult browser voice flow.

The browser does not talk to ElevenLabs directly. It talks only to our backend WebSocket, and the backend owns:

- ElevenLabs session creation
- session overrides (`prompt`, `voice_id`, `turn_detection`)
- call registration and persistence
- billing timeout enforcement
- transcript polling and post-call billing

## Endpoint

Connect to:

```text
ws(s)://<api-host>/adult/ws/voice/{influencer_id}?token=<jwt>
```

Notes:

- `token` is the same app JWT pattern used by the existing websocket routes.
- `influencer_id` is required in the path.
- This flow is adult-only and expects a valid adult subscription plus follow access on the backend.

## Session Start

The first WebSocket message must be:

```json
{
  "type": "start_call",
  "character_id": 123,
  "timezone": "Australia/Brisbane"
}
```

Rules:

- `type` must be exactly `start_call`
- `character_id` is required
- `timezone` is optional

If the first message is anything else, the backend returns:

```json
{
  "type": "error",
  "error": "INVALID_START",
  "message": "First message must be start_call."
}
```

and closes the socket.

## Client → Backend Messages

### `start_call`

Starts the backend-owned ElevenLabs session.

```json
{
  "type": "start_call",
  "character_id": 123,
  "timezone": "Australia/Brisbane"
}
```

### `input_audio_chunk`

Send mic audio as base64-encoded PCM16 little-endian mono 16 kHz.

```json
{
  "type": "input_audio_chunk",
  "audio": "<base64 pcm16le mono 16k>"
}
```

Requirements:

- mono
- 16-bit signed PCM
- 16 kHz sample rate
- base64 string in JSON

If `audio` is missing or not a string, the backend returns:

```json
{
  "type": "error",
  "error": "INVALID_AUDIO",
  "message": "audio must be a base64 PCM string."
}
```

### `ping`

Optional keepalive from the client.

```json
{
  "type": "ping"
}
```

Backend responds with:

```json
{
  "type": "pong"
}
```

### `stop_call`

Ends the call cleanly.

```json
{
  "type": "stop_call"
}
```

## Backend → Client Messages

### `state`

Call lifecycle and speaking-state updates.

```json
{
  "type": "state",
  "state": "connecting"
}
```

Possible states:

- `connecting`
- `listening`
- `agent_speaking`
- `ending`
- `ended`

The `ended` state may include a reason:

```json
{
  "type": "state",
  "state": "ended",
  "reason": "client_stop"
}
```

Known reasons currently emitted by the backend:

- `client_stop`
- `client_disconnect`
- `credit_timeout`
- `upstream_error`
- `server_error`
- `setup_error`
- `ended`

### `call_started`

Sent after ElevenLabs returns conversation initiation metadata and the backend has a `conversation_id`.

```json
{
  "type": "call_started",
  "chat_id": "chat_uuid",
  "conversation_id": "conv_uuid",
  "credits_remainder_secs": 321
}
```

Frontend should store `chat_id` and `conversation_id` for analytics/debug UI only. No follow-up registration call is needed from the frontend.

### `output_audio_chunk`

AI audio from the backend as base64 PCM16 little-endian mono 16 kHz.

```json
{
  "type": "output_audio_chunk",
  "audio": "<base64 pcm16le mono 16k>"
}
```

Frontend should decode this and queue it for playback immediately.

### `remaining_time`

Coarse call countdown updates from the backend.

```json
{
  "type": "remaining_time",
  "seconds": 120
}
```

Behavior:

- sent every 5 seconds while more than 10 seconds remain
- sent every 1 second for the last 10 seconds

### `error`

Machine-readable error event.

Basic shape:

```json
{
  "type": "error",
  "error": "UPSTREAM_ERROR",
  "message": "Voice service unavailable."
}
```

Billing/setup errors may include extra fields:

```json
{
  "type": "error",
  "error": "INSUFFICIENT_CREDITS",
  "message": "Adult voice setup failed.",
  "needed_cents": 500,
  "free_left": 0
}
```

Handle these error codes explicitly:

- `INVALID_START`
- `INVALID_AUDIO`
- `UNKNOWN_MESSAGE_TYPE`
- `UPSTREAM_ERROR`
- `SERVER_ERROR`
- `INSUFFICIENT_CREDITS`
- `SUBSCRIPTION_REQUIRED`
- `SUBSCRIPTION_EXPIRED`
- `HTTP_ERROR`

## Close Codes

Useful backend close codes:

- `4001`: missing JWT token
- `4002`: invalid JWT
- `4003`: unexpected server error
- `4400`: invalid request/setup error
- `4401`: expired JWT
- `4403`: forbidden or payment/subscription access failure

Frontend should treat close codes `4401` and `4403` as product errors, not reconnectable transport failures.

## Audio Requirements

The frontend must send PCM16 mono 16 kHz.

Recommended browser pipeline:

1. Call `navigator.mediaDevices.getUserMedia({ audio: true })`
2. Feed the mic stream into Web Audio
3. Convert float samples to mono
4. Resample to 16 kHz if the device context is not already 16 kHz
5. Convert floats in `[-1, 1]` to signed 16-bit PCM
6. Chunk, base64-encode, and send as `input_audio_chunk`

For playback:

1. Decode base64 audio from `output_audio_chunk`
2. Interpret bytes as PCM16 mono 16 kHz
3. Convert to `Float32Array`
4. Schedule playback through `AudioContext`

## Recommended Frontend State Model

Track at least:

- `socketStatus`: `idle | connecting | open | closed | error`
- `callState`: `connecting | listening | agent_speaking | ending | ended`
- `conversationId: string | null`
- `chatId: string | null`
- `remainingSeconds: number | null`
- `error: { code: string; message: string } | null`
- `isMicStreaming: boolean`
- `isPlaybackActive: boolean`

Recommended UX behavior:

- disable the call button while `socketStatus === "connecting"`
- start mic capture only after the socket opens
- show "Connecting..." on `state=connecting`
- show "Listening..." on `state=listening`
- show "Speaking..." on `state=agent_speaking`
- stop capture and playback when `state=ended` or the socket closes

## React Integration Outline

Recommended component split:

- `useAdultVoiceCall`
  - owns WebSocket lifecycle
  - owns AudioContext lifecycle
  - exposes `startCall`, `stopCall`, `mute`, and UI state
- `MicCapture`
  - captures raw mic audio
  - converts to PCM16 mono 16 kHz
  - pushes chunks to the hook callback
- `PcmPlayer`
  - queues and plays PCM16 mono 16 kHz audio returned by the backend

Suggested hook API:

```ts
type StartCallArgs = {
  influencerId: string;
  characterId: number;
  token: string;
  timezone?: string;
};

type AdultVoiceState = {
  socketStatus: "idle" | "connecting" | "open" | "closed" | "error";
  callState: "connecting" | "listening" | "agent_speaking" | "ending" | "ended" | null;
  conversationId: string | null;
  chatId: string | null;
  remainingSeconds: number | null;
  error: { code: string; message: string } | null;
};
```

## Message Handling Skeleton

```ts
socket.onopen = () => {
  socket.send(
    JSON.stringify({
      type: "start_call",
      character_id: characterId,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }),
  );
};

socket.onmessage = (event) => {
  const msg = JSON.parse(event.data);

  switch (msg.type) {
    case "call_started":
      setChatId(msg.chat_id);
      setConversationId(msg.conversation_id);
      setRemainingSeconds(msg.credits_remainder_secs);
      break;
    case "state":
      setCallState(msg.state);
      if (msg.state === "ended") {
        teardownAudio();
      }
      break;
    case "output_audio_chunk":
      player.enqueueBase64Pcm16(msg.audio);
      break;
    case "remaining_time":
      setRemainingSeconds(msg.seconds);
      break;
    case "error":
      setError({ code: msg.error, message: msg.message });
      break;
    case "pong":
      break;
  }
};
```

Mic uplink:

```ts
function sendPcmChunk(base64Audio: string) {
  socket.send(
    JSON.stringify({
      type: "input_audio_chunk",
      audio: base64Audio,
    }),
  );
}
```

Stop:

```ts
socket.send(JSON.stringify({ type: "stop_call" }));
```

## Important Backend Behavior

The frontend should be aware of these server-side behaviors:

- The backend delays user-audio forwarding while the AI is speaking.
- The backend automatically registers the ElevenLabs conversation and schedules post-call persistence.
- The backend also enforces the credit timeout and can end the call without a frontend command.
- The frontend does not need to call ElevenLabs token or signed-url endpoints for this flow.

## Frontend Acceptance Checklist

- Connects to `/adult/ws/voice/{influencer_id}?token=...`
- Sends `start_call` as the first message
- Captures mic audio and sends PCM16 mono 16 kHz base64 chunks
- Plays `output_audio_chunk` audio in near real time
- Updates UI from `state`, `call_started`, `remaining_time`, and `error`
- Handles `4401` and `4403` as non-retryable user-facing failures
- Sends `stop_call` on hang-up and cleans up audio resources on close
