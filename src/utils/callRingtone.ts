import { Howl } from "howler";

const RINGTONE_SRC = "/audio/ringtone.mp3";

export type CallRingtoneController = {
  start: () => void;
  stop: () => void;
  unload: () => void;
};

export function createCallRingtoneController(): CallRingtoneController {
  let ringtone: Howl | null = null;

  const getRingtone = (): Howl => {
    if (!ringtone) {
      ringtone = new Howl({
        src: [RINGTONE_SRC],
        loop: true,
        html5: false,
      });
    }

    return ringtone;
  };

  return {
    start: () => {
      try {
        const sound = getRingtone();
        if (!sound.playing()) {
          sound.play();
        }
      } catch (error) {
        console.error("Ringtone playback failed:", error);
      }
    },
    stop: () => {
      if (ringtone) {
        ringtone.stop();
      }
    },
    unload: () => {
      if (ringtone) {
        ringtone.stop();
        ringtone.unload();
        ringtone = null;
      }
    },
  };
}
