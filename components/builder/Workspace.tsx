'use client'

import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { Stage, Layer, Rect, Line, Text, Image as KImage, Transformer, Group } from 'react-konva'
import type Konva from 'konva'
import useImage from 'use-image'
import { SHEETS, CANVAS_PPI, GRID_IN, SNAP_IN, BOUNDARY_MARGIN_IN } from '@/lib/builder/constants'
import type { ArtworkItem, Layout } from '@/lib/builder/types'
import { computeSnapGuides, type SnapGuide } from '@/lib/builder/align'

const SNAP_GUIDE_TOL_PX = 4 // snap when within 4 screen pixels

interface Props {
  layout: Layout
  selectedId: string | null
  zoom: number
  showGrid: boolean
  snap: boolean
  onSelect: (id: string | null) => void
  onUpdate: (id: string, patch: Partial<ArtworkItem>) => void
  onCanvasSize?: (w: number, h: number) => void
}

export default function Workspace({ layout, selectedId, zoom, showGrid, snap, onSelect, onUpdate, onCanvasSize }: Props) {
  const sheet = SHEETS[layout.sheetSizeId]
  const wPx = sheet.widthIn * CANVAS_PPI
  const hPx = sheet.lengthIn * CANVAS_PPI
  const stageRef = useRef<Konva.Stage>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const trRef = useRef<Konva.Transformer>(null)
  const [containerSize, setContainerSize] = useState({ w: 800, h: 600 })

  // Live measurement while dragging or transforming an item
  const [liveInfo, setLiveInfo] = useState<
    | { id: string; xIn: number; yIn: number; widthIn: number; heightIn: number; rotationDeg: number }
    | null
  >(null)

  // Live snap guides while dragging
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([])

  // Track container size
  useEffect(() => {
    if (!containerRef.current) return
    const el = containerRef.current
    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect()
      setContainerSize({ w: rect.width, h: rect.height })
      onCanvasSize?.(rect.width, rect.height)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [onCanvasSize])

  // Attach transformer to the selected item
  useEffect(() => {
    const tr = trRef.current
    if (!tr) return
    const stage = stageRef.current
    if (!stage) return
    if (!selectedId) { tr.nodes([]); tr.getLayer()?.batchDraw(); return }
    const node = stage.findOne(`#item-${selectedId}`) as Konva.Node | undefined
    if (node) {
      tr.nodes([node])
      tr.getLayer()?.batchDraw()
    } else {
      tr.nodes([])
    }
  }, [selectedId, layout.items])

  // Center + fit-friendly sizing
  const scale = zoom
  const RULER = 28 // px reserved for rulers
  const stageW = Math.max(containerSize.w, wPx * scale + RULER + 40)
  const stageH = Math.max(containerSize.h, hPx * scale + RULER + 40)
  // Anchor top-left with a small padding + ruler gutter (NOT centered)
  const offsetX = RULER + 8
  const offsetY = RULER + 8

  const snapVal = (val: number) => (snap ? Math.round(val / SNAP_IN) * SNAP_IN : val)

  const gridLines = useMemo(() => {
    if (!showGrid) return null
    const lines: ReactElement[] = []
    for (let x = 0; x <= sheet.widthIn; x += GRID_IN) {
      const isInch = Math.abs(x - Math.round(x)) < 1e-6
      lines.push(
        <Line key={`vx${x}`} points={[x * CANVAS_PPI, 0, x * CANVAS_PPI, hPx]} stroke={isInch ? '#ffffff22' : '#ffffff10'} strokeWidth={1 / scale} listening={false} />
      )
    }
    for (let y = 0; y <= sheet.lengthIn; y += GRID_IN) {
      const isInch = Math.abs(y - Math.round(y)) < 1e-6
      lines.push(
        <Line key={`hy${y}`} points={[0, y * CANVAS_PPI, wPx, y * CANVAS_PPI]} stroke={isInch ? '#ffffff22' : '#ffffff10'} strokeWidth={1 / scale} listening={false} />
      )
    }
    return lines
  }, [showGrid, sheet.widthIn, sheet.lengthIn, wPx, hPx, scale])

  // Inch-ruler ticks + labels along the top and left of the sheet.
  const rulers = useMemo(() => {
    const marks: ReactElement[] = []
    const invScale = 1 / scale
    // Top ruler
    for (let i = 0; i <= sheet.widthIn; i += 1) {
      const x = i * CANVAS_PPI
      const tickLen = i % 2 === 0 ? 10 : 6
      marks.push(
        <Line
          key={`tt${i}`}
          points={[x, -tickLen * invScale, x, 0]}
          stroke="#a855f7"
          strokeWidth={1 * invScale}
          listening={false}
        />
      )
      if (i % 2 === 0) {
        marks.push(
          <Text
            key={`tl${i}`}
            x={x - 6 * invScale}
            y={-22 * invScale}
            text={`${i}`}
            fontSize={10 * invScale}
            fill="#d8b4fe"
            listening={false}
          />
        )
      }
    }
    // Left ruler
    for (let i = 0; i <= sheet.lengthIn; i += 1) {
      const y = i * CANVAS_PPI
      const tickLen = i % 2 === 0 ? 10 : 6
      marks.push(
        <Line
          key={`lt${i}`}
          points={[-tickLen * invScale, y, 0, y]}
          stroke="#a855f7"
          strokeWidth={1 * invScale}
          listening={false}
        />
      )
      if (i % 2 === 0) {
        marks.push(
          <Text
            key={`ll${i}`}
            x={-22 * invScale}
            y={y - 4 * invScale}
            text={`${i}`}
            fontSize={10 * invScale}
            fill="#d8b4fe"
            listening={false}
          />
        )
      }
    }
    return marks
  }, [sheet.widthIn, sheet.lengthIn, scale])

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-auto bg-neutral-950">
      <Stage
        ref={stageRef}
        width={stageW}
        height={stageH}
        onMouseDown={(e) => { if (e.target === e.target.getStage()) onSelect(null) }}
        onTouchStart={(e) => { if (e.target === e.target.getStage()) onSelect(null) }}
      >
        <Layer x={offsetX} y={offsetY} scaleX={scale} scaleY={scale}>
          {/* Sheet background */}
          <Rect
            x={0}
            y={0}
            width={wPx}
            height={hPx}
            fill="#0a0a0a"
            stroke="#a855f7"
            strokeWidth={2 / scale}
            shadowColor="#d946ef"
            shadowBlur={30}
            shadowOpacity={0.4}
          />
          {/* Safe margin outline */}
          <Rect
            x={BOUNDARY_MARGIN_IN * CANVAS_PPI}
            y={BOUNDARY_MARGIN_IN * CANVAS_PPI}
            width={(sheet.widthIn - 2 * BOUNDARY_MARGIN_IN) * CANVAS_PPI}
            height={(sheet.lengthIn - 2 * BOUNDARY_MARGIN_IN) * CANVAS_PPI}
            stroke="#ffffff33"
            strokeWidth={1 / scale}
            dash={[6 / scale, 4 / scale]}
            listening={false}
          />
          {gridLines}
          {rulers}

          {/* Items */}
          {[...layout.items].sort((a, b) => a.zIndex - b.zIndex).map((item) => (
            <CanvasArtwork
              key={item.id}
              item={item}
              allItems={layout.items}
              sheetSizeId={layout.sheetSizeId}
              sheetWidthIn={sheet.widthIn}
              sheetLengthIn={sheet.lengthIn}
              snapVal={snapVal}
              scale={scale}
              isSelected={selectedId === item.id}
              onSelect={() => onSelect(item.id)}
              onUpdate={(patch) => onUpdate(item.id, patch)}
              onLive={setLiveInfo}
              onSnapGuides={setSnapGuides}
            />
          ))}

          {/* Live snap guide lines (magenta, from sheet edge to sheet edge) */}
          {snapGuides.map((g, i) => (
            <Line
              key={`snap-${i}`}
              points={g.orientation === 'v'
                ? [g.atIn * CANVAS_PPI, 0, g.atIn * CANVAS_PPI, hPx]
                : [0, g.atIn * CANVAS_PPI, wPx, g.atIn * CANVAS_PPI]}
              stroke="#d946ef"
              strokeWidth={1 / scale}
              dash={[6 / scale, 4 / scale]}
              listening={false}
              shadowColor="#d946ef"
              shadowBlur={6 / scale}
              shadowOpacity={0.8}
            />
          ))}

          {/* Live measurement overlay shown while dragging / transforming */}
          {liveInfo && (() => {
            const badgeX = liveInfo.xIn * CANVAS_PPI
            const badgeY = liveInfo.yIn * CANVAS_PPI - 22 / scale
            const label = `${liveInfo.widthIn.toFixed(2)} × ${liveInfo.heightIn.toFixed(2)} in`
            const posLabel = `x ${liveInfo.xIn.toFixed(2)}  y ${liveInfo.yIn.toFixed(2)}${liveInfo.rotationDeg ? `  ${Math.round(liveInfo.rotationDeg)}°` : ''}`
            const pad = 4 / scale
            const fs = 11 / scale
            const boxH = 30 / scale
            const boxW = 150 / scale
            return (
              <Group listening={false}>
                <Rect
                  x={badgeX}
                  y={badgeY}
                  width={boxW}
                  height={boxH}
                  fill="#0a0a0a"
                  stroke="#d946ef"
                  strokeWidth={1 / scale}
                  cornerRadius={3 / scale}
                  shadowColor="#d946ef"
                  shadowBlur={12 / scale}
                  shadowOpacity={0.6}
                />
                <Text
                  x={badgeX + pad}
                  y={badgeY + pad}
                  text={label}
                  fontSize={fs}
                  fontStyle="bold"
                  fill="#ffffff"
                />
                <Text
                  x={badgeX + pad}
                  y={badgeY + pad + fs + 1 / scale}
                  text={posLabel}
                  fontSize={fs * 0.9}
                  fill="#d8b4fe"
                />
              </Group>
            )
          })()}

          <Transformer
            ref={trRef}
            rotateEnabled
            keepRatio
            enabledAnchors={[
              'top-left', 'top-right', 'bottom-left', 'bottom-right',
            ]}
            anchorFill="#d946ef"
            anchorStroke="#ffffff"
            anchorSize={10}
            borderStroke="#d946ef"
            borderStrokeWidth={2 / scale}
            rotateAnchorOffset={30}
            boundBoxFunc={(oldBox, newBox) => {
              // Prevent 0 size
              if (Math.abs(newBox.width) < 8 || Math.abs(newBox.height) < 8) return oldBox
              return newBox
            }}
          />
        </Layer>
      </Stage>
    </div>
  )
}

interface CanvasArtworkProps {
  item: ArtworkItem
  allItems: ArtworkItem[]
  sheetSizeId: Layout['sheetSizeId']
  sheetWidthIn: number
  sheetLengthIn: number
  snapVal: (v: number) => number
  scale: number
  isSelected: boolean
  onSelect: () => void
  onUpdate: (patch: Partial<ArtworkItem>) => void
  onLive: (info: { id: string; xIn: number; yIn: number; widthIn: number; heightIn: number; rotationDeg: number } | null) => void
  onSnapGuides: (guides: SnapGuide[]) => void
}

function CanvasArtwork({ item, allItems, sheetSizeId, sheetWidthIn, sheetLengthIn, snapVal, scale, isSelected, onSelect, onUpdate, onLive, onSnapGuides }: CanvasArtworkProps) {
  const [img] = useImage(item.artworkUrl, 'anonymous')
  const shapeRef = useRef<Konva.Image>(null)

  const emitLive = (extra?: Partial<{ xIn: number; yIn: number; widthIn: number; heightIn: number; rotationDeg: number }>) => {
    const node = shapeRef.current
    if (!node) return
    const sx = node.scaleX()
    const sy = node.scaleY()
    const wPx = Math.abs(node.width() * sx)
    const hPx = Math.abs(node.height() * sy)
    onLive({
      id: item.id,
      xIn: extra?.xIn ?? node.x() / CANVAS_PPI,
      yIn: extra?.yIn ?? node.y() / CANVAS_PPI,
      widthIn: extra?.widthIn ?? Math.max(0.01, wPx / CANVAS_PPI),
      heightIn: extra?.heightIn ?? Math.max(0.01, hPx / CANVAS_PPI),
      rotationDeg: extra?.rotationDeg ?? node.rotation(),
    })
  }

  return (
    <KImage
      id={`item-${item.id}`}
      ref={shapeRef}
      image={img as any}
      x={item.xIn * CANVAS_PPI}
      y={item.yIn * CANVAS_PPI}
      width={item.widthIn * CANVAS_PPI}
      height={item.heightIn * CANVAS_PPI}
      rotation={item.rotationDeg}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      dragBoundFunc={(pos) => {
        // pos is in stage coords. Convert to inches (relative to sheet Layer).
        // Our Layer already has offsetX/Y and scale, so pos is in Layer-local px * scale + offset.
        // Konva provides the RAW stage pos; we need to reverse the Layer transform.
        const stage = shapeRef.current?.getStage()
        if (!stage) return pos
        const layerNode = shapeRef.current!.getLayer()!
        // Convert stage-space -> layer-space:
        const layerAbs = layerNode.getAbsoluteTransform().copy().invert()
        const local = layerAbs.point(pos)
        const xIn = local.x / CANVAS_PPI
        const yIn = local.y / CANVAS_PPI

        const tolIn = SNAP_GUIDE_TOL_PX / CANVAS_PPI
        const { xIn: sx, yIn: sy, guides } = computeSnapGuides({
          drag: { xIn, yIn, widthIn: item.widthIn, heightIn: item.heightIn, id: item.id },
          others: allItems,
          sheetSizeId,
          tolIn,
        })
        onSnapGuides(guides)

        // Clamp inside safe margin
        const cx = Math.max(BOUNDARY_MARGIN_IN, Math.min(sx, sheetWidthIn - BOUNDARY_MARGIN_IN - item.widthIn))
        const cy = Math.max(BOUNDARY_MARGIN_IN, Math.min(sy, sheetLengthIn - BOUNDARY_MARGIN_IN - item.heightIn))

        // Convert back to stage coords
        const snapped = layerNode.getAbsoluteTransform().point({ x: cx * CANVAS_PPI, y: cy * CANVAS_PPI })
        return snapped
      }}
      onDragStart={() => { onSelect(); emitLive() }}
      onDragMove={() => emitLive()}
      onTransformStart={() => emitLive()}
      onTransform={() => emitLive()}
      onDragEnd={(e) => {
        const node = e.target
        const xIn = snapVal(node.x() / CANVAS_PPI)
        const yIn = snapVal(node.y() / CANVAS_PPI)
        const clampedX = Math.max(BOUNDARY_MARGIN_IN, Math.min(xIn, sheetWidthIn - BOUNDARY_MARGIN_IN - item.widthIn))
        const clampedY = Math.max(BOUNDARY_MARGIN_IN, Math.min(yIn, sheetLengthIn - BOUNDARY_MARGIN_IN - item.heightIn))
        node.position({ x: clampedX * CANVAS_PPI, y: clampedY * CANVAS_PPI })
        onUpdate({ xIn: clampedX, yIn: clampedY })
        onLive(null)
        onSnapGuides([])
      }}
      onTransformEnd={() => {
        const node = shapeRef.current
        if (!node) return
        const scaleX = node.scaleX()
        const scaleY = node.scaleY()
        const newWidthPx = Math.max(8, node.width() * scaleX)
        const newHeightPx = Math.max(8, node.height() * scaleY)
        node.scaleX(1)
        node.scaleY(1)
        const widthIn = Math.max(0.25, newWidthPx / CANVAS_PPI)
        const heightIn = Math.max(0.25, newHeightPx / CANVAS_PPI)
        const xIn = node.x() / CANVAS_PPI
        const yIn = node.y() / CANVAS_PPI
        const rot = node.rotation()
        onUpdate({ widthIn, heightIn, xIn, yIn, rotationDeg: rot })
        onLive(null)
      }}
    />
  )
}

// Keep the import graph happy in strict TS mode
export type WorkspaceProps = Props

// noop use to satisfy potential unused imports in strict mode
void Group
