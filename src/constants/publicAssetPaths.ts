export const PublicAssetPaths = {
  ringtone: "/audio/ringtone.mp3",
  avatarImage: (folder: string, index: number) =>
    `/avatarImages/${folder}/avatar${index}.jpg`,
} as const;
