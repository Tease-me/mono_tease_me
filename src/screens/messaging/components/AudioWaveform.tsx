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
            const gain = 2;
            const maxBarHeight = h * 0.45;
            const minBarHeight = 0.5;
            const midY = h / 2;
            ctx.clearRect(0, 0, w, h);
            ctx.fillStyle = '#FF981F';
            const barWidth = 4;
            const barGap = 2;

            const numBars = Math.floor(w / (barWidth + barGap));
            for (let i = 0; i < numBars; i++) {
                ctx.beginPath();
                const x = i * (barWidth + barGap);
                const position = i * (sampleCount - 1) / (numBars - 1);
                const left = Math.floor(position);
                const right = Math.min(sampleCount - 1, left + 1);
                const frac = position - left;
                const sample = data[left] + (data[right] - data[left]) * frac;
                let barHeight = (sample * h) / 2 * gain;
                if (barHeight > maxBarHeight) barHeight = maxBarHeight;
                if (barHeight < minBarHeight) barHeight = minBarHeight;
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