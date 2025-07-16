import React, { useRef, useEffect, useState } from 'react';

interface AudioWaveformProps {
    audioBlob: Blob;
    width: number;
    height: number;
}

const AudioWaveform = ({ audioBlob, width, height }: AudioWaveformProps) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        if (!audioBlob) return;

        const drawStaticWaveform = async () => {
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const arrayBuffer = await audioBlob.arrayBuffer();
            const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
            const data = audioBuffer.getChannelData(0);

            const canvas = canvasRef.current!;
            canvas.width = width;
            canvas.height = height;
            const ctx: CanvasRenderingContext2D = canvas.getContext('2d')!;
            const w = width;
            const h = height;
            const sampleCount = data.length;
            const midY = h / 2;
            ctx.clearRect(0, 0, w, h);
            ctx.fillStyle = '#FF981F';
            const barWidth = 6;
            const barGap = 2;

            const numBars = Math.floor(w / (barWidth + barGap));
            const samplesPerBar = Math.floor(sampleCount / numBars);

            const amplitudes = new Array<number>(numBars);
            for (let i = 0; i < numBars; i++) {
                const start = i * samplesPerBar;
                const dataArray = data
                    .slice(start, start + samplesPerBar)
                    .map(v => Math.abs(v));
                const sum = dataArray.reduce((acc, val) => acc + val, 0);
                amplitudes[i] = sum / dataArray.length; // 0…1
            }

            const maxAmp = Math.max(...amplitudes, 1);

            ctx.beginPath();
            for (let i = 0; i < numBars; i++) {
                const x = i * (barWidth + barGap);
                const amplitude = amplitudes[i] / maxAmp;
                const fullH = h;
                let barHeight = amplitude * fullH;
                barHeight = Math.max(barHeight, 1);
                barHeight = Math.min(barHeight, fullH * 0.8);
                ctx.roundRect(x, midY - barHeight, barWidth, barHeight * 2, barWidth / 2);
                ctx.fill();
            }
            audioCtx.close();
        };
        drawStaticWaveform();
    }, [audioBlob, width, height]);

    return <canvas ref={canvasRef} width={width} height={height} />;
};

export default AudioWaveform;
