import React, { useRef, useEffect, useState } from 'react';

interface AudioVisualizerProps {
    mediaStream: MediaStream;
    onStop?: (blob: Blob) => void;
    speed?: number;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ mediaStream, onStop, speed }) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    const [isRecording, setIsRecording] = useState(false);
    const [elapsed, setElapsed] = useState('00:00');
    const timerRef = useRef<number | null>(null);

    useEffect(() => {
        if (!mediaStream) return;
        if (!isRecording) return;
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        const audioCtx = audioContextRef.current!;
        const source = audioCtx.createMediaStreamSource(mediaStream);
        analyserRef.current = audioCtx.createAnalyser();
        analyserRef.current.fftSize = 256;
        source.connect(analyserRef.current);

        mediaRecorderRef.current = new MediaRecorder(mediaStream);
        chunksRef.current = [];
        mediaRecorderRef.current.ondataavailable = (e) => chunksRef.current.push(e.data);
        mediaRecorderRef.current.onstop = () => {
            const blob = new Blob(chunksRef.current, { type: mediaRecorderRef.current?.mimeType });
            if (onStop) onStop(blob);
        };
        mediaRecorderRef.current.start();

        let startTime = Date.now();
        timerRef.current = window.setInterval(() => {
            const diff = Date.now() - startTime;
            const m = String(Math.floor(diff / 60000)).padStart(2, '0');
            const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
            setElapsed(`${m}:${s}`);
        }, 500);

        drawVisualizer();
        return () => {
            mediaRecorderRef.current?.stop();
            audioContextRef.current?.close();
            if (timerRef.current) clearInterval(timerRef.current);
            setElapsed('00:00');
        };
    }, [mediaStream, isRecording, onStop]);

    const startRecording = () => setIsRecording(true);
    const stopRecording = () => setIsRecording(false);

    const drawVisualizer = () => {
        if (canvasRef.current && analyserRef.current) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            const analyser = analyserRef.current;
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            const bufferCanvas = document.createElement('canvas');
            bufferCanvas.width = canvas.width;
            bufferCanvas.height = canvas.height;
            const bufferCtx = bufferCanvas.getContext('2d');

            const barWidth = 6;
            const barGap = 2;

            const shiftValue = typeof speed === 'number' ? speed : barWidth + barGap;

            // Accumulator for consistent bar spacing when shifting
            let xOffsetAccumulator = 0;

            const animate = () => {
                analyser.getByteFrequencyData(dataArray);

                if (ctx && bufferCtx) {
                    bufferCtx.clearRect(0, 0, bufferCanvas.width, bufferCanvas.height);
                    bufferCtx.drawImage(canvas, 0, 0);
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    // Shift buffer onto main canvas
                    const shift = shiftValue;
                    ctx.drawImage(bufferCanvas, -shift, 0);
                    // Compute bar height
                    const sum = dataArray.reduce((acc, val) => acc + val, 0);
                    const avg = sum / dataArray.length;
                    let h = (avg / 255) * canvas.height;
                    h = Math.max(h, 1);
                    h = Math.min(h, canvas.height * 0.8);
                    // Accumulate shift to determine when to draw the next bar
                    xOffsetAccumulator += shift;
                    const spacing = barWidth + barGap;
                    if (xOffsetAccumulator >= spacing) {
                        xOffsetAccumulator -= spacing;
                        // Draw the bar with consistent spacing
                        const x = canvas.width - barWidth - xOffsetAccumulator;
                        const y = (canvas.height - h) / 2;
                        ctx.fillStyle = `rgba(255, 152, 31, ${Math.floor(avg) + 100})`;
                        ctx.beginPath();
                        if (ctx.roundRect) {
                            ctx.roundRect(x, y, barWidth, h, barWidth / 2);
                            ctx.fill();
                        } else {
                            ctx.fillRect(x, y, barWidth, h);
                        }
                    }
                }

                requestAnimationFrame(animate);
            };
            animate();
        }
    };

    return (
        <div style={{ position: 'relative', width: 600, userSelect: 'none' }}>
            <canvas ref={canvasRef} width="600" height="200" style={{
                filter: isRecording ? 'grayscale(0%)' : 'grayscale(80%)'
            }} />
            {isRecording && (
                <div style={{
                    position: 'absolute',
                    bottom: 8,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(0,0,0,0.6)',
                    color: '#fff',
                    padding: '2px 6px',
                    borderRadius: 4,
                    fontSize: 12,
                }}>
                    ● {elapsed}
                </div>
            )}
            <button
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onMouseLeave={() => isRecording && stopRecording()}
                style={{
                    position: 'absolute',
                    right: 8,
                    bottom: 8,
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: isRecording ? '#d92b2b' : '#eee',
                    border: 'none',
                    cursor: 'pointer',
                }}
            />
        </div>
    );
};

export default AudioVisualizer;