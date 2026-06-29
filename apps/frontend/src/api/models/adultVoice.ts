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

export type AdultVoiceSceneUpdate = {
  stage_index: number;
  variant_index: number;
  stage_tag: string | null;
  tags: string[];
  title: string;
  description: string;
  video_mp4_url: string | null;
  video_webm_url: string | null;
  poster_url: string | null;
  match_distance?: number;
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
    }
  | ({
      type: "scene_update";
    } & AdultVoiceSceneUpdate);

export type AdultVoiceError = {
  code: string;
  message: string;
};
