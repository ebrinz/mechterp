import { Canvas } from '@react-three/fiber'
import { OrbitControls, Line, Text, Billboard } from '@react-three/drei'
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

/** Per-emotion landmark: a wireframe sphere at the centroid + a camera-facing text label. */
function CentroidLabel({ emotion, xyz }: { emotion: string; xyz: XYZ }) {
  const color = emotionColor(emotion)
  return (
    <group position={xyz}>
      <mesh>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshBasicMaterial color={color} wireframe />
      </mesh>
      <Billboard>
        <Text fontSize={0.12} color={color} anchorX="center" anchorY="bottom" position={[0, 0.14, 0]} outlineWidth={0.01} outlineColor="#000000" renderOrder={10}>
          {emotion}
        </Text>
      </Billboard>
    </group>
  )
}

function LivePoint({ live, trail }: { live: XYZ | null; trail: XYZ[] }) {
  return (
    <group>
      {trail.length > 1 && (
        // drei's <Line> is the supported way to draw a polyline in r3f.
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
  return (
    <Canvas camera={{ position: [0, 0, 9], fov: 50 }} dpr={[1, 2]}>
      <ambientLight intensity={0.9} />
      <group position={recenter}>
        <ReferenceCloud points={points} />
        {centroids.map((c) => (
          <CentroidLabel key={c.emotion} emotion={c.emotion} xyz={c.xyz} />
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
