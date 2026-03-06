import React, { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform float uTime;
  uniform vec2 uResolution;
  varying vec2 vUv;

  vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }

  float snoise(vec2 v) {
    const vec4 C = vec4(
      0.211324865405187,
      0.366025403784439,
      -0.577350269189626,
      0.024390243902439
    );

    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);

    vec2 i1;
    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);

    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;

    i = mod(i, 289.0);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));

    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m;
    m = m * m;

    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;

    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);

    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;

    return 130.0 * dot(m, g);
  }

  void main() {
    vec2 uv = vUv;
    uv.x *= uResolution.x / uResolution.y;

    float t = uTime * 0.08;

    vec2 q = vec2(0.0);
    q.x = snoise(uv + vec2(t * 0.10, t * 0.15));
    q.y = snoise(uv + vec2(-t * 0.08, t * 0.12));

    vec2 r = vec2(0.0);
    r.x = snoise(uv + 1.0 * q + vec2(1.7, 9.2) + 0.15 * t);
    r.y = snoise(uv + 1.0 * q + vec2(8.3, 2.8) + 0.126 * t);

    float f = snoise(uv + r);

    vec3 darkMetal = vec3(0.85, 0.87, 0.90);
    vec3 brightSilver = vec3(0.96, 0.97, 0.99);
    vec3 specularWhite = vec3(1.0, 1.0, 1.0);

    vec3 col = mix(darkMetal, brightSilver, smoothstep(-0.4, 0.5, f));
    col = mix(col, specularWhite, smoothstep(0.7, 1.0, f) * 0.8);

    gl_FragColor = vec4(col, 1.0);
  }
`;

type LiquidUniforms = {
  uTime: { value: number };
  uResolution: { value: THREE.Vector2 };
};

const LiquidPlane: React.FC = () => {
  const meshRef = useRef<THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> | null>(null);
  const { viewport, size } = useThree();

  const uniforms = useMemo<LiquidUniforms>(() => {
    return {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(size.width, size.height) },
    };
  }, []);

  useEffect(() => {
    uniforms.uResolution.value.set(size.width, size.height);
  }, [size.width, size.height, uniforms]);

  useFrame((state) => {
    const material = meshRef.current?.material;
    if (material) {
      (material.uniforms as LiquidUniforms).uTime.value = state.clock.getElapsedTime();
    }
  });

  return (
    <mesh ref={meshRef} scale={[viewport.width, viewport.height, 1]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        depthWrite={false}
      />
    </mesh>
  );
};

const LiquidMetalBackground: React.FC = () => {
  return (
    <div className="absolute inset-0 w-full h-full">
      <Canvas
        orthographic
        camera={{ position: [0, 0, 1], zoom: 1 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        dpr={[1, 2]}
      >
        <LiquidPlane />
      </Canvas>
    </div>
  );
};

export default LiquidMetalBackground;
