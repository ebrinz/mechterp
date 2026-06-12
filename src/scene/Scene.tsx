import { Canvas } from '@react-three/fiber'
import { OrbitControls, Line, Text, Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { useMemo, useState } from 'react'
import type { Point, XYZ } from '../types'
import { emotionColor } from './colors'

interface Props {
  points: Point[]
  centroids: { emotion: string; xyz: XYZ }[]
  live: XYZ | null
  trail: XYZ[]
}

/** Bounding-box center of the cloud — used to recenter so orbit/zoom pivot on the data. */
function cloudCenter(points: Point[]): XYZ {
  if (!points.length) return [0, 0, 0]
  let minx = Infinity, miny = Infinity, minz = Infinity
  let maxx = -Infinity, maxy = -Infinity, maxz = -Infinity
  for (const p of points) {
    const [x, y, z] = p.xyz
    if (x < minx) minx = x; if (x > maxx) maxx = x
    if (y < miny) miny = y; if (y > maxy) maxy = y
    if (z < minz) minz = z; if (z > maxz) maxz = z
  }
  return [(minx + maxx) / 2, (miny + maxy) / 2, (minz + maxz) / 2]
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
      <pointsMaterial size={0.06} vertexColors sizeAttenuation />
    </points>
  )
}

/** Per-emotion landmark: a small wireframe sphere; label reveals on hover/tap to keep the
 *  default view uncluttered (most centroids overlap, so always-on labels are a jumble). */
function Centroid({
  emotion,
  xyz,
  active,
  onActivate,
}: {
  emotion: string
  xyz: XYZ
  active: boolean
  onActivate: (e: string | null) => void
}) {
  const color = emotionColor(emotion)
  return (
    <group position={xyz}>
      <mesh
        onPointerOver={(e) => { e.stopPropagation(); onActivate(emotion) }}
        onPointerOut={() => onActivate(null)}
        onPointerDown={(e) => { e.stopPropagation(); onActivate(emotion) }}
      >
        <sphereGeometry args={[active ? 0.18 : 0.11, 16, 16]} />
        <meshBasicMaterial color={color} wireframe={!active} transparent opacity={active ? 0.6 : 1} />
      </mesh>
      {active && (
        <Billboard>
          <Text fontSize={0.18} color={color} anchorX="center" anchorY="bottom" position={[0, 0.24, 0]} outlineWidth={0.012} outlineColor="#000000" renderOrder={10}>
            {emotion}
          </Text>
        </Billboard>
      )}
    </group>
  )
}

function LivePoint({ live, trail }: { live: XYZ | null; trail: XYZ[] }) {
  return (
    <group>
      {trail.length > 1 && (
        <Line points={trail} color="#ffffff" lineWidth={1.5} transparent opacity={0.45} />
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
  const center = useMemo(() => cloudCenter(points), [points])
  // Translate the whole scene so the cloud's center sits at the origin — then OrbitControls'
  // default target (0,0,0) pivots on the data instead of empty space off to one side.
  const recenter: XYZ = [-center[0], -center[1], -center[2]]
  const [activeEmotion, setActiveEmotion] = useState<string | null>(null)

  return (
    <Canvas
      camera={{ position: [0, 0, 9], fov: 50 }}
      dpr={[1, 2]}
      onPointerMissed={() => setActiveEmotion(null)}
    >
      <ambientLight intensity={0.9} />
      <group position={recenter}>
        <ReferenceCloud points={points} />
        {centroids.map((c) => (
          <Centroid
            key={c.emotion}
            emotion={c.emotion}
            xyz={c.xyz}
            active={activeEmotion === c.emotion}
            onActivate={setActiveEmotion}
          />
        ))}
        <LivePoint live={live} trail={trail} />
      </group>
      <OrbitControls
        makeDefault
        enablePan
        enableZoom
        enableRotate
        zoomSpeed={0.5}
        rotateSpeed={0.6}
        panSpeed={0.6}
        enableDamping
        dampingFactor={0.12}
        minDistance={2}
        maxDistance={30}
      />
    </Canvas>
  )
}
