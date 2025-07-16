import React, { useRef, useEffect, useState } from 'react';

interface AudioWaveformProps {
    audioBlob: Blob;
}

const AudioWaveform = ({ audioBlob }: AudioWaveformProps) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        if (!audioBlob) return;

        const drawStaticWaveform = async () => {
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const arrayBuffer = await audioBlob.arrayBuffer();
            const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
            const data = audioBuffer.getChannelData(0);

            const canvas = canvasRef.current!;
            const ctx: CanvasRenderingContext2D = canvas.getContext('2d')!;
            const width = canvas.width;
            const height = canvas.height;
            const sampleCount = data.length;
            const gain = 2;
            const maxBarHeight = height * 0.45;
            const minBarHeight = 0.5;
            const midY = height / 2;
            ctx.clearRect(0, 0, width, height);
            ctx.fillStyle = '#FF981F';
            const barWidth = 4;
            const barGap = 2;

            const numBars = Math.floor(width / (barWidth + barGap));
            for (let i = 0; i < numBars; i++) {
                ctx.beginPath();
                const x = i * (barWidth + barGap);
                const position = i * (sampleCount - 1) / (numBars - 1);
                const left = Math.floor(position);
                const right = Math.min(sampleCount - 1, left + 1);
                const frac = position - left;
                const sample = data[left] + (data[right] - data[left]) * frac;
                let barHeight = (sample * height) / 2 * gain;
                if (barHeight > maxBarHeight) barHeight = maxBarHeight;
                if (barHeight < minBarHeight) barHeight = minBarHeight;
                ctx.roundRect(x, midY - barHeight, barWidth, barHeight * 2, barWidth / 2);
                ctx.fill();
            }
            audioCtx.close();
        };
        drawStaticWaveform();
    }, [audioBlob]);

    return <canvas ref={canvasRef} />;
};

export default AudioWaveform;