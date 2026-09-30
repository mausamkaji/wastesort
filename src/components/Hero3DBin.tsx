import React, { useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

/**
 * Procedurally-built recycling bin — no external .glb/.gltf asset or textures,
 * so there's nothing to license or fetch. Rotates continuously and picks up
 * extra spin/tilt tied to page scroll position, mirroring the scroll-linked
 * 3D product viewer pattern (e.g. the Oryzo site's rotating coaster).
 */
function RecyclingBin() {
  const group = useRef<THREE.Group>(null);
  const scrollY = useRef(0);
  const autoRotation = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      scrollY.current = window.scrollY;
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useFrame((_, delta) => {
    autoRotation.current += delta * 0.12;
    if (!group.current) return;
    group.current.rotation.y = autoRotation.current + scrollY.current * 0.0025;
    group.current.rotation.x = Math.sin(scrollY.current * 0.0012) * 0.12;
    group.current.position.y = Math.sin(autoRotation.current * 0.8) * 0.04;
  });

  return (
    <group ref={group} position={[0, -0.2, 0]}>
      {/* Body — tapered cylinder like a real wheelie bin */}
      <mesh castShadow receiveShadow position={[0, 0, 0]}>
        <cylinderGeometry args={[1.05, 0.85, 2.1, 32]} />
        <meshStandardMaterial color="#059669" roughness={0.45} metalness={0.08} />
      </mesh>

      {/* Lid */}
      <mesh castShadow position={[0, 1.18, 0]}>
        <cylinderGeometry args={[1.12, 1.1, 0.22, 32]} />
        <meshStandardMaterial color="#f59e0b" roughness={0.4} metalness={0.1} />
      </mesh>

      {/* Lid handle */}
      <mesh castShadow position={[0, 1.36, 0]}>
        <torusGeometry args={[0.16, 0.045, 12, 24]} />
        <meshStandardMaterial color="#1c1917" roughness={0.6} />
      </mesh>

      {/* Recycling arrows ring accent */}
      <mesh position={[0, 0.05, 0.86]} rotation={[0.1, 0, 0]}>
        <torusGeometry args={[0.4, 0.055, 12, 3]} />
        <meshStandardMaterial color="#ecfdf5" roughness={0.35} emissive="#10b981" emissiveIntensity={0.15} />
      </mesh>

      {/* Wheels */}
      {[-0.62, 0.62].map((x) => (
        <mesh key={x} castShadow position={[x, -1.15, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.22, 0.22, 0.18, 20]} />
          <meshStandardMaterial color="#292524" roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

export const Hero3DBin: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={className} aria-hidden="true">
      <Canvas
        shadows
        camera={{ position: [3.2, 1.4, 4.2], fov: 38 }}
        gl={{ alpha: true, antialias: true }}
        dpr={[1, 2]}
      >
        <ambientLight intensity={0.55} />
        <directionalLight
          position={[4, 5, 3]}
          intensity={1.4}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <pointLight position={[-4, 2, -3]} intensity={0.6} color="#fbbf24" />
        <RecyclingBin />
        <ContactShadows position={[0, -1.35, 0]} opacity={0.45} scale={6} blur={2.4} far={2} />
      </Canvas>
    </div>
  );
};
