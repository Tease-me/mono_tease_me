export type AdultVoiceSocketStatus =
  | "idle"
  | "connecting"
  | "open"
  | "closed"
  | "error";

export type AdultVoiceCallState =
  | "connecting"
  | "listening"
  | "agent_speaking"
  | "ending"
  | "ended"
  | null;

export type AdultVoiceClientMessage =
  | {
      type: "start_call";
      character_id: number;
      timezone?: string;
    }
  | {
      type: "input_audio_chunk";
      audio: string;
    }
  | {
      type: "ping";
    }
  | {
      type: "stop_call";
    };

export type AdultVoiceServerMessage =
  | {
      type: "state";
      state: Exclude<AdultVoiceCallState, null>;
      reason?: string;
    }
  | {
      type: "call_started";
      chat_id: string;
      conversation_id: string;
      credits_remainder_secs: number | null;
    }
  | {
      type: "output_audio_chunk";
      audio: string;
    }
  | {
      type: "remaining_time";
      seconds: number;
    }
  | {
      type: "error";
      error: string;
      message: string;
      needed_cents?: number;
      free_left?: number;
    }
  | {
      type: "pong";
    };

export type AdultVoiceError = {
  code: string;
  message: string;
};
