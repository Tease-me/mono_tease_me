import { useFrame } from "@react-three/fiber";
import React, { useRef } from "react";
import * as THREE from "three";

const AudioCircle = ({
  analyser,
  color = "#000",
  radius = 0.7,
  maxThickness = 0.8,
}) => {
  const meshRef = useRef();
  // Only try to read fftSize if analyser exists, fallback to 256
  const segments = analyser.current?.fftSize || 256;
  const dataArray = useRef(new Uint8Array(segments));

  useFrame(() => {
    if (analyser.current && meshRef.current) {
      analyser.current.getByteTimeDomainData(dataArray.current);

      const avg =
        dataArray.current.reduce((acc, val) => acc + Math.abs(val - 128), 0) /
        dataArray.current.length;

      const thickness = 0.15 + (avg / 64) * maxThickness;

      meshRef.current.geometry.dispose();
      meshRef.current.geometry = new THREE.RingGeometry(
        radius,
        radius + thickness,
        128
      );
      meshRef.current.material.opacity = 0.2 + 0.2 * (avg / 128);
    }
  });

  return (
    <mesh ref={meshRef}>
      <ringGeometry args={[radius, radius + 0.1, 128]} />
      <meshBasicMaterial color={color} transparent opacity={0.2} />
    </mesh>
  );
};
export default AudioCircle;
