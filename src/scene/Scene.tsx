import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { useMemo } from 'react'
import type { Point, XYZ } from '../types'
import { emotionColor } from './colors'

interface Props {
  points: Point[]
  centroids: { emotion: string; xyz: XYZ }[]
  live: XYZ | null
  trail: XYZ[]
}

function ReferenceCloud({ points }: { points: Point[] }) {
  const { positions, colors } = useMemo(() => {
    const positions = new Float32Array(points.length * 3)
    const colors = new Float32Array(points.length * 3)
    const c = new THREE.Color()
    points.forEach((p, i) => {
      positions.set(p.xyz, i * 3)
      c.set(emotionColor(p.emotion))
      colors.set([c.r, c.g, c.b], i * 3)
    })
    return { positions, colors }
  }, [points])
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.08} vertexColors sizeAttenuation />
    </points>
  )
}

function LivePoint({ live, trail }: { live: XYZ | null; trail: XYZ[] }) {
  const trailGeom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setFromPoints(trail.map((t) => new THREE.Vector3(...t)))
    return g
  }, [trail])
  return (
    <group>
      {trail.length > 1 && (
        <threeLine>
          <primitive object={trailGeom} attach="geometry" />
          <lineBasicMaterial color="#ffffff" transparent opacity={0.4} />
        </threeLine>
      )}
      {live && (
        <mesh position={live}>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      )}
    </group>
  )
}

export function Scene({ points, centroids, live, trail }: Props) {
  return (
    <Canvas camera={{ position: [0, 0, 12], fov: 50 }} dpr={[1, 2]}>
      <ambientLight intensity={0.8} />
      <ReferenceCloud points={points} />
      {centroids.map((c) => (
        <mesh key={c.emotion} position={c.xyz}>
          <sphereGeometry args={[0.18, 16, 16]} />
          <meshBasicMaterial color={emotionColor(c.emotion)} wireframe />
        </mesh>
      ))}
      <LivePoint live={live} trail={trail} />
      <OrbitControls enablePan enableZoom enableRotate makeDefault />
    </Canvas>
  )
}
