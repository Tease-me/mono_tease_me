import React, { useRef, useState, useEffect } from 'react';

import PlayButtonIcon from "@/assets/svg/Play.svg?react";
import PauseButtonIcon from "@/assets/svg/Pause.svg?react";
import styles from "./AudioPlayer.module.css"
import { showErrorModal } from '@/utils/errorModal';

interface AudioPlayerProps {
    src: string;
    height?: number;
    width?: number;
    progressColor?: string;
    onPlay?: (src: string) => void;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ src, height, width, progressColor = '#FF981F', onPlay }) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [peaks, setPeaks] = useState<number[]>([]);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const togglePlay = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            onPlay?.(src);
            audioRef.current.play().catch(() => {
                showErrorModal({
                    title: "Audio Error",
                    message: "Failed to play audio"
                });
                setIsPlaying(false);
            });
        }
    };

    useEffect(() => {
        if (!src) return;
        fetch(src)
            .then(res => res.arrayBuffer())
            .then(buffer => {
                const audioCtx = new AudioContext();
                return audioCtx.decodeAudioData(buffer).then(decoded => {
                    audioCtx.close();
                    return decoded;
                });
            })
            .then(audioBuffer => {
                const raw = audioBuffer.getChannelData(0);
                const samples = 100;
                const block = Math.floor(raw.length / samples);
                const data: number[] = [];
                for (let i = 0; i < samples; i++) {
                    let sum = 0;
                    for (let j = 0; j < block; j++) {
                        sum += Math.abs(raw[i * block + j]);
                    }
                    data.push(sum / block);
                }
                const max = Math.max(...data);
                setPeaks(data.map(n => n / max));
            })
            .catch(console.error);
    }, [src]);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        const handlePlay = () => setIsPlaying(true);
        const handlePause = () => setIsPlaying(false);
        const handleEnded = () => setIsPlaying(false);
        audio.addEventListener("play", handlePlay);
        audio.addEventListener("pause", handlePause);
        audio.addEventListener("ended", handleEnded);
        return () => {
            audio.removeEventListener("play", handlePlay);
            audio.removeEventListener("pause", handlePause);
            audio.removeEventListener("ended", handleEnded);
        };
    }, [src]);


    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || peaks.length === 0) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        // handle resizing
        const resize = () => {
            const { width } = canvas.getBoundingClientRect();
            const height = 50;
            canvas.width = width;
            canvas.height = height;
        };
        resize();
        window.addEventListener('resize', resize);
        let animationFrameId: number;
        const draw = () => {
            const width = canvas.width;
            const height = canvas.height;
            ctx.clearRect(0, 0, width, height);
            const gap = 2; // gap in pixels between bars
            const barW = (width - (peaks.length - 1) * gap) / peaks.length;
            // draw background waveform
            ctx.fillStyle = "#FFFFFF";
            peaks.forEach((val, i) => {
                const barH = val * height;
                const x = i * (barW + gap);
                ctx.fillRect(x, (height - barH) / 2, barW, barH);
            });
            // draw played portion
            const audio = audioRef.current;
            const playedWidth = audio && audio.duration
                ? (audio.currentTime / audio.duration) * width
                : 0;
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, playedWidth, height);
            ctx.clip();
            ctx.fillStyle = progressColor;
            peaks.forEach((val, i) => {
                const barH = val * height;
                const x = i * (barW + gap);
                ctx.fillRect(x, (height - barH) / 2, barW, barH);
            });
            ctx.restore();
            animationFrameId = requestAnimationFrame(draw);
        };
        draw();
        return () => {
            cancelAnimationFrame(animationFrameId);
            window.removeEventListener('resize', resize);
        };
    }, [peaks]);

    return (
        <div className={styles.audioPlayer}>
            <button onClick={togglePlay} className={styles.playButton}>
                {isPlaying ? <PauseButtonIcon /> : <PlayButtonIcon />}
            </button>
            <canvas ref={canvasRef} className={styles.waveformCanvas} height={height} width={width} />
            <audio
                ref={audioRef}
                src={src}
                onEnded={() => setIsPlaying(false)}
            />
        </div>
    );
};

export default AudioPlayer;
