import { useFrame } from "@react-three/fiber";
import React, { useRef } from "react";
import * as THREE from "three";

const AudioLine = ({ analyser, color }) => {
  const meshRef = useRef();
  const segments = 256;
  const points = useRef(
    new Array(segments).fill().map(() => new THREE.Vector3())
  );
  const dataArray = useRef(new Uint8Array(segments));

  useFrame(() => {
    if (analyser.current && meshRef.current) {
      analyser.current.getByteTimeDomainData(dataArray.current);
      const width = 20;
      const amplitude = 2.0;
      for (let i = 0; i < segments; i++) {
        const x = (i / segments) * width - width / 2;
        const y = (dataArray.current[i] / 128.0 - 1) * amplitude;
        points.current[i].set(x, y, 0);
      }
      const curve = new THREE.CatmullRomCurve3(points.current);
      meshRef.current.geometry.dispose();
      meshRef.current.geometry = new THREE.TubeGeometry(
        curve,
        segments,
        0.07,
        8,
        false
      ); // Espessura = 0.05
    }
  });

  return (
    <mesh ref={meshRef}>
      <tubeGeometry
        args={[
          new THREE.CatmullRomCurve3(points.current),
          segments,
          0.05,
          8,
          false,
        ]}
      />
      <meshBasicMaterial color={color} />
    </mesh>
  );
};

export default AudioLine;
