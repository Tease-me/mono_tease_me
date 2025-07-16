import React, { useRef, useEffect, useState } from 'react';

interface AudioBlobVisualizerProps { }

const AudioBlobVisualizer: React.FC<AudioBlobVisualizerProps> = () => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const [recording, setRecording] = useState(false);

    useEffect(() => {
        if (!recording) return;
        const startStream = async () => {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            const audioCtx = audioContextRef.current;
            const source = audioCtx.createMediaStreamSource(stream);
            analyserRef.current = audioCtx.createAnalyser();
            analyserRef.current.fftSize = 256;
            source.connect(analyserRef.current);

            mediaRecorderRef.current = new MediaRecorder(stream);
            chunksRef.current = [];
            mediaRecorderRef.current.ondataavailable = (e) => {
                chunksRef.current.push(e.data);
            };
            mediaRecorderRef.current.start();

            drawVisualizer();
        };
        startStream();
        return () => {
            mediaRecorderRef.current?.stop();
            audioContextRef.current?.close();
        };
    }, [recording]);

    const drawVisualizer = () => {
        if (canvasRef.current && analyserRef.current) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            const analyser = analyserRef.current;
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            const animate = () => {
                analyser.getByteFrequencyData(dataArray);

                ctx?.clearRect(0, 0, canvas.width, canvas.height);

                // Example: Simple bars for demonstration
                const barWidth = (canvas.width / bufferLength) * 2.5;
                let x = 0;
                for (let i = 0; i < bufferLength; i++) {
                    const barHeight = dataArray[i] / 2;
                    if (ctx) ctx.fillStyle = `rgb(${barHeight + 100},50,50)`;
                    ctx?.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
                    x += barWidth + 1;
                }

                requestAnimationFrame(animate);
            };
            animate();
        }
    };

    return (
        <>
            <canvas ref={canvasRef} width="600" height="200" />
            <button onClick={() => setRecording(true)} disabled={recording}>Start Recording</button>
            <button onClick={() => {
                setRecording(false);
                mediaRecorderRef.current?.stop();
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                // handle the recorded blob, e.g., pass to parent or download
            }} disabled={!recording}>Stop Recording</button>
        </>
    );
};

export default AudioBlobVisualizer;