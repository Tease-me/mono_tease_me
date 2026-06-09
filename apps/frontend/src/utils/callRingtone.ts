import { Howl } from "howler";
import { PublicAssetPaths } from "@/constants/publicAssetPaths";

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
        src: [PublicAssetPaths.ringtone],
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
