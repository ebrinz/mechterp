import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Line, Text, Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Point, XYZ } from '../types'
import { emotionColor } from './colors'
import { nearestPointToCursor } from './picking'

const PICK_RADIUS_PX = 14

interface Props {
  points: Point[]
  centroids: { emotion: string; xyz: XYZ }[]
  live: XYZ | null
  trail: XYZ[]
  focusedIndex?: number | null
  onPickPoint?: (index: number | null) => void
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

/** Screen-space picker: projects recentered points to pixels each pointer event and reports the
 *  nearest under the cursor. Lives inside the Canvas for useThree access. Renders nothing. */
function PointPicker({
  points,
  center,
  onHover,
  onPick,
}: {
  points: Point[]
  center: XYZ
  onHover: (i: number | null) => void
  onPick: (i: number | null) => void
}) {
  const { camera, gl, size } = useThree()
  const base = useMemo(
    () => points.map((p) => new THREE.Vector3(p.xyz[0] - center[0], p.xyz[1] - center[1], p.xyz[2] - center[2])),
    [points, center],
  )
  const onHoverRef = useRef(onHover); onHoverRef.current = onHover
  const onPickRef = useRef(onPick); onPickRef.current = onPick

  useEffect(() => {
    const el = gl.domElement as HTMLElement
    const scratch = new THREE.Vector3()
    const project = () =>
      base.map((b, i) => {
        scratch.copy(b).project(camera)
        return { index: i, x: (scratch.x * 0.5 + 0.5) * size.width, y: (-scratch.y * 0.5 + 0.5) * size.height }
      })
    const toCursor = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }
    let downAt: { x: number; y: number } | null = null
    const onMove = (e: PointerEvent) => {
      const i = nearestPointToCursor(project(), toCursor(e), PICK_RADIUS_PX)
      onHoverRef.current(i)
      el.style.cursor = i != null ? 'pointer' : ''
    }
    const onDown = (e: PointerEvent) => { downAt = toCursor(e) }
    const onUp = (e: PointerEvent) => {
      const up = toCursor(e)
      if (downAt && Math.hypot(up.x - downAt.x, up.y - downAt.y) < 6) {
        onPickRef.current(nearestPointToCursor(project(), up, PICK_RADIUS_PX))
      }
      downAt = null
    }
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointerup', onUp)
    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointerup', onUp)
      el.style.cursor = ''
    }
  }, [base, camera, gl, size])

  return null
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

export function Scene({ points, centroids, live, trail, focusedIndex = null, onPickPoint = () => {} }: Props) {
  const center = useMemo(() => cloudCenter(points), [points])
  const recenter: XYZ = [-center[0], -center[1], -center[2]]
  const [activeEmotion, setActiveEmotion] = useState<string | null>(null)
  const [hovered, setHovered] = useState<number | null>(null)

  return (
    <Canvas
      camera={{ position: [0, 0, 9], fov: 50 }}
      dpr={[1, 2]}
      onPointerMissed={() => setActiveEmotion(null)}
    >
      <ambientLight intensity={0.9} />
      <PointPicker points={points} center={center} onHover={setHovered} onPick={onPickPoint} />
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
        {hovered != null && points[hovered] && (
          <mesh position={points[hovered].xyz}>
            <sphereGeometry args={[0.07, 12, 12]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.85} />
          </mesh>
        )}
        {focusedIndex != null && points[focusedIndex] && (
          <mesh position={points[focusedIndex].xyz}>
            <sphereGeometry args={[0.16, 16, 16]} />
            <meshBasicMaterial color="#ffffff" wireframe />
          </mesh>
        )}
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
