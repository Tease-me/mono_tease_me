import { useEffect, useState } from 'react';

export const useAudioDuration = (src: string): number | undefined => {
    const [duration, setDuration] = useState<number | undefined>();

    useEffect(() => {
        if (!src) return;

        const audio = new Audio();
        const handleLoadedMetadata = () => {
            setDuration(audio.duration);
        };

        audio.addEventListener('loadedmetadata', handleLoadedMetadata);
        audio.src = src;

        return () => {
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
            audio.src = '';
        };
    }, [src]);

    return duration;
};
