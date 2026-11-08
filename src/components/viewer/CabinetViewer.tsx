import { Canvas } from "@react-three/fiber"
import { QUALITY } from "./renderQuality"
import { GuideRoom, PresentationRoom } from "./PresentationRoom"
import { ModuleLegs } from "./Hardware"
import { SceneAccess, StudioEnvironment, TextureRefresh } from "./SceneHelpers"
import { Grid } from "@react-three/drei"
import { useContext, useEffect, useMemo, useRef, useState } from "react"
import { ContactShadow } from "./ContactShadow"
import { BoxFrame } from "./BoxFrame"
import { NeutralToneMapping, type Vector3 } from "three"
import { releaseModelGpu } from "./models3d"
import { transformAt } from "./opening"
import { S } from "./cabinet/constants"
import type { CabinetViewerProps } from "./cabinet/types"
import { useViewerLook } from "./cabinet/useViewerLook"
import { usePanelVisuals } from "./cabinet/usePanelVisuals"
import { usePanelHandlers } from "./cabinet/usePanelHandlers"
import { useObjectBoxes } from "./cabinet/useObjectBoxes"
import { ExplodeWith, MovingPanel } from "./cabinet/motion"
import { PanelMesh, WIRE_OPACITY } from "./cabinet/PanelMesh"
import { RefGhost } from "./cabinet/RefGhost"
import { ModelMesh } from "./cabinet/ModelMesh"
import { MoveHandle } from "./cabinet/MoveHandle"
import { CableMarks, HoverCursor, ZoneHighlight } from "./cabinet/Highlights"
import { CameraRig } from "./cabinet/CameraRig"
import { panelBox } from "../../core/build/geometry"
import { hoverKey, hoverTarget, useHoverLink } from "../hoverLink"
import { useFaceHover, useFacePick, useSketchOverlay } from "./facePick"
import { SketchLines } from "./cabinet/SketchLines"
import { CarveContext, SectionCapContext, SectionClip } from "./cabinet/SectionClip"
import type { Panel } from "../../core/model"

/** Anar a un avís: el contorn de les seves peces i la transparència de la resta. */
const ALERT_COLOR = "#dc2626"
const ALERT_VEIL = 0.22

// Peces que fan servir altres pantalles (Preferències › Ferratges, la foto realista).
export { MovingPanel } from "./cabinet/motion"
export { PanelMesh } from "./cabinet/PanelMesh"
export type { ViewerModule } from "./cabinet/types"

export function CabinetViewer({
  panels,
  size,
  exploded,
  showHoles = true,
  seeThrough: seeThroughAll,
  modules,
  selectedModuleId,
  onSelectModule,
  ghosts,
  viewDir = null,
  wireAll = false,
  section = null,
  opening = 0,
  openOnly = null,
  materialMode = "material",
  materials = [],
  quality = "fast",
  hardware = true,
  onSceneAccess,
  onDeselect,
  onContextClick,
  selectedRefId,
  onSelectRef,
  onMoveRef,
  onMoveModule,
  parts,
  selectedPartId,
  onSelectPart,
  onMovePart,
  selectedSet,
  onMoveSet,
  models,
  selectedModelId,
  onSelectModel,
  onMoveModel,
  selectedHardwareId,
  onSelectHardware,
  collidingRefIds,
  cuttingRefIds,
  highlightZone,
  hoverZone,
  hoverAt,
  fitKey = 0,
  onFramedChange,
  initialCamera,
  onCameraChange,
  cameraGoto,
  cameraFly,
  alertPanels,
  sceneFinish,
}: CabinetViewerProps) {
  // Per distingir un clic a l'espai buit d'un gir de càmera (arrossegar).
  const downAt = useRef<[number, number] | null>(null)
  const q = QUALITY[quality]
  const { scene, light, bg, gridCell, gridSection } = useViewerLook(sceneFinish)
  // Parets dels costats (`Composition.scene`): a ras de la peça de més a l'esquerra i de més a la dreta del moble.
  const leftWall = !!sceneFinish?.leftWall, rightWall = !!sceneFinish?.rightWall
  const sideWalls = useMemo(() => {
    if ((!leftWall && !rightWall) || !panels.length) return undefined
    let x0 = Infinity, x1 = -Infinity
    for (const p of panels) {
      const b = panelBox(p)
      x0 = Math.min(x0, b.min[0])
      x1 = Math.max(x1, b.max[0])
    }
    const at = (x: number) => (x - size.width * 0.5) * S
    return { ...(leftWall ? { left: at(x0) } : {}), ...(rightWall ? { right: at(x1) } : {}) }
  }, [leftWall, rightWall, panels, size.width])
  // «Pinta la cara tallada»: el pla, perquè només les peces que travessa pintin el tall.
  const sectionCap = useMemo(() => (section?.paint ? { axis: section.axis, pos: section.pos } : null), [section?.paint, section?.axis, section?.pos])
  const selected = modules?.find((m) => m.id === selectedModuleId)
  const selectedIndex = selected?.index
  // Vistes Davant · Darrere · Esquerra · Dreta · Dalt (per decisió de l'usuari, 2026-10-14: «sense perspectiva i amb
  // fils, per poder moure la peça seleccionada»): càmera ortogràfica (`CameraRig`) i el moble en línies, les peces gairebé
  // transparents amb el perfil i els forats a la vista. «Enquadrar» torna al 3/4 en perspectiva.
  const wire = viewDir !== null || wireAll
  const holesShown = showHoles || wire
  // Modelatge (`CarveContext`, fora del Canvas): els forats buidats, i la peça es refà quan canvien.
  const carve = useContext(CarveContext)
  const holesDrawn = holesShown || hardware || carve
  const { groupOf, panelKeys, pinsOf, fixedOf } = usePanelVisuals(panels, holesDrawn, hardware)
  // Mòdul (o moble sencer) que s'està arrossegant amb la nansa: desplaçament en viu.
  // Element sota el ratolí (aquí o a la seva fila de l'arbre, `useHoverLink`): contorn suau, perquè es vegi què se
  // seleccionarà en clicar.
  const link = useHoverLink()
  const hovered = hoverTarget(link.hover)
  const isHovered = (kind: string, id: string) => hovered?.kind === kind && hovered.id === id
  // Un objecte que talla pot ser una peça lliure (`part:id`): la mateixa fila que la peça.
  const ghostKey = (id: string) => (id.startsWith("part:") ? hoverKey("part", id.slice(5)) : hoverKey("ref", id))
  const [moduleDrag, setModuleDrag] = useState<{ index: number; dx: number; dy: number; dz: number; all: boolean } | null>(null)
  const { onFittingSelect, onPanelHover, onPanelClick } = usePanelHandlers({ onSelectModule, onSelectPart, onSelectHardware, modules, size, hoverAt }, link)
  // Una eina de clicar cares activa (Modelatge, `facePick.ts`): el clic va a l'eina, amb el punt en mm i la normal.
  const facePick = useFacePick()
  const sketchLines = useSketchOverlay()
  const faceHover = useFaceHover()
  const onFaceHover = useMemo(
    () =>
      faceHover
        ? (p: Panel, on: boolean, pt?: Vector3, n?: Vector3) => faceHover(on && pt && n ? { panel: p, point: [pt.x / S + size.width / 2, pt.y / S, pt.z / S + size.depth / 2], normal: [n.x, n.y, n.z] } : null)
        : undefined,
    [faceHover, size.width, size.depth],
  )
  const onFaceClick = useMemo(
    () => (facePick ? (p: Panel, pt: Vector3, n?: Vector3) => n && facePick({ panel: p, point: [pt.x / S + size.width / 2, pt.y / S, pt.z / S + size.depth / 2], normal: [n.x, n.y, n.z] }) : undefined),
    [facePick, size.width, size.depth],
  )
  const { snapTargets, moduleBoxes, partBoxes, selectedPartBox, modelBoxes, selectedModelBox, setBox, selectedModel } = useObjectBoxes({ size, modules, parts, models, ghosts, selectedSet, selectedPartId, selectedModelId })
  // Un sol imant per a tot el que es mou amb el gizmo (per decisió de l'usuari, 2026-10-16: «uns s'enganxen ràpid i altres
  // no»): les vores i el mig dels mòduls, les peces lliures, els models i els objectes, menys els que es mouen, amb les
  // guies del Figma (`snapWithGuides`); a més, `snapTargets`: terra i paret. La distància, en píxels de pantalla.
  const snapOthers = (moving: ReadonlySet<string> = new Set()) => [...moduleBoxes, ...partBoxes, ...modelBoxes, ...(ghosts ?? [])].filter((b) => !moving.has(b.id))
  // De la caixa girada a la cantonada del model (el gizmo mou la caixa).
  const toModelPos = (pos: { x: number; y: number; z: number }) => (selectedModel && selectedModelBox ? { x: pos.x - selectedModelBox.x + selectedModel.x, y: pos.y, z: pos.z - selectedModelBox.z + selectedModel.z } : pos)
  // Els models comparteixen geometria i materials (memòria de `models3d`): en tancar el visor (o recrear el
  // renderitzador en canviar la qualitat) s'alliberen de la GPU; si no, el renderitzador mort quedaria viu a través
  // dels seus escoltadors.
  useEffect(() => () => releaseModelGpu(), [quality])
  // Model que s'arrossega amb el gizmo: es mou en viu (posició en mm).
  const [modelDrag, setModelDrag] = useState<{ id: string; x: number; y: number; z: number } | null>(null)

  return (
    // Canviar la qualitat recrea el renderitzador: les ombres no es poden activar en calent.
    // Només pinta quan alguna cosa canvia (`frameloop="demand"`): els controls, les animacions (obrir, explosionar,
    // enquadrar) i les textures que arriben demanen el fotograma (`invalidate`). A l'iPhone, un visor quiet no gasta.
    <Canvas
      key={quality}
      frameloop="demand"
      // PCF amb el radi de sempre (el «soft» de three ja ho és; PCFSoftShadowMap s'ha retirat i avisava).
      shadows={q.shadows ? "percentage" : false}
      dpr={q.dpr}
      style={{ touchAction: "none" }}
      gl={{ preserveDrawingBuffer: true, alpha: true }}
      // Com model-viewer: to «neutral» (colors fidels, sense cremar els blancs).
      onCreated={({ gl }) => {
        gl.toneMapping = NeutralToneMapping
      }}
      onPointerDown={(e) => {
        downAt.current = [e.clientX, e.clientY]
      }}
      // Botó dret: arrossegant mou la càmera; un clic sense moure's obre les propietats (`onContextClick`).
      onPointerUp={onContextClick ? (e) => {
        const d = downAt.current
        if (e.button === 2 && d && Math.hypot(e.clientX - d[0], e.clientY - d[1]) < 5) onContextClick(e.clientX, e.clientY)
      } : undefined}
      onContextMenu={onContextClick ? (e) => e.preventDefault() : undefined}
      onPointerMissed={(e) => {
        const d = downAt.current
        if (onDeselect && d && Math.hypot(e.clientX - d[0], e.clientY - d[1]) < 5) onDeselect()
      }}
    >
      {/* Mà sobre les peces d'un mòdul que es pot triar. */}
      <HoverCursor active={hovered?.kind === "module" || hovered?.kind === "part" || hovered?.kind === "zone"} />
      <color attach="background" args={[q.guides ? bg : scene.wall]} />
      {/* Llum d'entorn (IBL) d'un estudi procedural, com model-viewer: reflexos i ombrejat suau. És l'única
          de l'escena: abans l'habitació de Presentació en posava una altra i, segons quina s'aplicava l'última
          (en clicar al 3D es tornava a aplicar la de l'habitació), tot el visor canviava de to. */}
      <StudioEnvironment intensity={q.guides ? 0.6 : 0.5 * light.env} />
      <TextureRefresh />
      <hemisphereLight intensity={(q.guides ? 0.55 : light.ambient) * 0.45} groundColor="#8a7a60" />
      {!q.guides && <PresentationRoom backZ={-size.depth * S * 0.5} scene={scene} materials={materials} sideWalls={sideWalls} />}
      {q.guides && sideWalls && <GuideRoom backZ={-size.depth * S * 0.5} sideWalls={sideWalls} />}
      {/* bias i normalBias eviten les ratlles (shadow acne) de les cares que s'ombregen a si mateixes. */}
      <directionalLight
        key={q.shadowMap}
        position={[2.5, 4, 3]}
        color={q.guides ? "#ffffff" : light.key}
        intensity={q.guides ? 1.4 : light.keyIntensity}
        castShadow={q.shadows}
        shadow-mapSize={q.shadowMap}
        shadow-bias={-0.0004}
        shadow-normalBias={0.015}
      />
      <directionalLight position={[-3, 2, -2]} intensity={0.35} />

      <CarveContext.Provider value={carve}>
      <SectionCapContext.Provider value={sectionCap}>
      <group position={[-size.width * S * 0.5, 0, -size.depth * S * 0.5]}>
        {sketchLines.length > 0 && <SketchLines lines={sketchLines} />}
        <SectionClip section={section} offset={[size.width / 2, 0, size.depth / 2]} />
        {panels.map((p) => {
          const g = groupOf.get(p.id)
          const active = !!g && (!openOnly || openOnly.has(g.id))
          const t = active ? opening : 0
          const tr = g ? transformAt(g.motion, t) : null
          const shifted = moduleDrag && (moduleDrag.all || p.module === moduleDrag.index)
          const isPart = p.id.startsWith("part:")
          const k = panelKeys.get(p.id)
          return (
            <group key={p.id} position={shifted ? [moduleDrag.dx * S, moduleDrag.dy * S, moduleDrag.dz * S] : ZERO3}>
            <MovingPanel transform={tr}>
              <PanelMesh
                panel={p}
                sig={k?.sig}
                place={k?.place}
                exploded={exploded}
                showHoles={holesShown}
                // Un avís: les seves peces sòlides i la resta translúcida (es veu on és).
                seeThrough={wire ? WIRE_OPACITY : alertPanels?.size && !alertPanels.has(p.id) ? ALERT_VEIL : seeThroughAll}
                wire={wire}
                // Mòdul triat: sòlid amb el contorn taronja. Translúcid només amb un compartiment triat (per veure'l a dins).
                dimmed={q.guides && !!highlightZone && highlightZone.veil !== false && selectedIndex !== undefined && p.module === selectedIndex}
                edges={q.guides || wire}
                materialMode={materialMode}
                materials={materials}
                hardware={hardware}
                pins={pinsOf.get(p.id)}
                fixed={fixedOf.get(p.id)}
                onHover={onFaceHover ?? ((isPart ? onSelectPart : onSelectModule) ? onPanelHover : undefined)}
                onClick={onFaceClick ?? ((isPart ? onSelectPart : onSelectModule) ? onPanelClick : undefined)}
                selectedFitting={selectedHardwareId && p.fittings?.some((f) => f.placement === selectedHardwareId) ? selectedHardwareId : null}
                onSelectFitting={onSelectHardware ? onFittingSelect : undefined}
              />
            </MovingPanel>
            </group>
          )
        })}
        {/* Els que tallen es veuen sempre (per decisió de l'usuari, 2026-10-14): en verd si tallen alguna peça, en vermell si
            no en tallen cap (mal col·locats). */}
        {ghosts?.map((g) => (
          <RefGhost
            key={g.id}
            g={g}
            materials={materials}
            selected={g.id === selectedRefId}
            hovered={link.hover === ghostKey(g.id)}
            onHover={(on) => (on ? link.enter(ghostKey(g.id)) : link.leave(ghostKey(g.id)))}
            hit={(collidingRefIds?.has(g.id) ?? false) || (g.effect === "cut" && !!cuttingRefIds && !cuttingRefIds.has(g.id))}
            guides={q.guides}
            offset={[-size.width * S * 0.5, 0, -size.depth * S * 0.5]}
            targets={snapTargets}
            others={snapOthers()}
            onSelect={onSelectRef}
            onMove={onMoveRef}
          />
        ))}
        {/* Peça lliura seleccionada: caixa taronja amb el gizmo (com un objecte). */}
        {selectedPartBox && (
          <RefGhost
            key={`part-${selectedPartBox.id}`}
            g={selectedPartBox}
            selected
            hit={false}
            guides={q.guides}
            offset={[-size.width * S * 0.5, 0, -size.depth * S * 0.5]}
            targets={snapTargets}
            others={snapOthers()}
            onSelect={onSelectPart}
            onMove={onMovePart}
            outline
          />
        )}
        {models?.map((m) => {
          const live = modelDrag?.id === m.id ? modelDrag : null
          return <ModelMesh key={m.id} m={m} selected={m.id === selectedModelId} hovered={isHovered("model", m.id)} onHover={(on) => (on ? link.enter(hoverKey("model", m.id)) : link.leave(hoverKey("model", m.id)))} shift={live ? [(live.x - m.x) * S, (live.y - m.y) * S, (live.z - m.z) * S] : undefined} onSelect={onSelectModel} materials={materials} />
        })}
        {/* Model seleccionat: contorn taronja amb el gizmo (com una peça lliure). */}
        {selectedModelBox && (
          <RefGhost
            key={`model-${selectedModelBox.id}`}
            g={selectedModelBox}
            selected
            hit={false}
            guides={q.guides}
            offset={[-size.width * S * 0.5, 0, -size.depth * S * 0.5]}
            targets={snapTargets}
            others={snapOthers()}
            onSelect={onSelectModel}
            onMove={onMoveModel ? (id, pos) => onMoveModel(id, toModelPos(pos)) : undefined}
            onDrag={(pos) => setModelDrag(pos && { id: selectedModelBox.id, ...toModelPos(pos) })}
            outline
          />
        )}
        {setBox && (
          <RefGhost
            key="multi"
            g={setBox}
            selected
            hit={false}
            guides={q.guides}
            offset={[-size.width * S * 0.5, 0, -size.depth * S * 0.5]}
            targets={snapTargets}
            others={snapOthers(new Set(selectedSet?.map((x) => x.id)))}
            onMove={onMoveSet ? (_, pos) => onMoveSet(pos.x - setBox.x, pos.y - setBox.y, pos.z - setBox.z) : undefined}
            outline
          />
        )}
        {/* Les potes de l'app van amb la base (que a l'explosió baixa). */}
        {hardware && modules?.map((m) => m.legs && !m.legs.fitted && !(moduleDrag && (moduleDrag.all || moduleDrag.index === m.index)) && (
          <ExplodeWith key={`legs-${m.id}`} exploded={exploded} dir={DOWN}>
            <ModuleLegs x={m.x} z={m.z ?? 0} width={m.width} depth={m.legs.depth} height={m.legs.height} inset={m.legs.inset} points={m.legs.points} />
          </ExplodeWith>
        ))}
        {highlightZone && <ZoneHighlight box={highlightZone} />}
        {/* Les peces d'un avís, amb un contorn vermell que es veu sempre. */}
        {alertPanels?.size ? panels.filter((p) => alertPanels.has(p.id)).slice(0, 40).map((p) => {
          const b = panelBox(p)
          return (
            <group key={`alert-${p.id}`} position={[((b.min[0] + b.max[0]) / 2) * S, ((b.min[1] + b.max[1]) / 2) * S, ((b.min[2] + b.max[2]) / 2) * S]}>
              <BoxFrame w={(b.max[0] - b.min[0] + 4) * S} h={(b.max[1] - b.min[1] + 4) * S} d={(b.max[2] - b.min[2] + 4) * S} strong color={ALERT_COLOR} />
            </group>
          )
        }) : null}
        {(() => {
          if (moduleDrag || !hovered) return null
          const hm = hovered.kind === "module" && hovered.id !== selectedModuleId ? modules?.find((m) => m.id === hovered.id) : undefined
          const hp = hovered.kind === "part" && hovered.id !== selectedPartId ? partBoxes.find((b) => b.id === hovered.id) : undefined
          const box = hm ? { x0: hm.x, x1: hm.x + hm.width, y0: hm.y, y1: hm.y + hm.height, z0: hm.z ?? 0, z1: (hm.z ?? 0) + hm.depth } : hp ? { x0: hp.x, x1: hp.x + hp.w, y0: hp.y, y1: hp.y + hp.h, z0: hp.z, z1: hp.z + hp.d } : hovered.kind === "zone" ? hoverZone : null
          return box ? (
            <group position={[((box.x0 + box.x1) / 2) * S, ((box.y0 + box.y1) / 2) * S, ((box.z0 + box.z1) / 2) * S]}>
              <BoxFrame w={(box.x1 - box.x0 + 6) * S} h={(box.y1 - box.y0 + 6) * S} d={(box.z1 - box.z0 + 6) * S} />
            </group>
          ) : null
        })()}
        {selectedIndex !== undefined && q.guides && <CableMarks panels={panels.filter((p) => p.module === selectedIndex)} />}
        {selected && onMoveModule && (
          <MoveHandle
            m={selected}
            others={snapOthers(new Set([selected.id]))}
            planes={snapTargets}
            onDrag={setModuleDrag}
            onDrop={(dx, dy, dz, all) => {
              setModuleDrag(null)
              if (dx || dy || dz) onMoveModule(selected.id, dx, dy, all, dz)
            }}
          />
        )}
      </group>
      </SectionCapContext.Provider>
      </CarveContext.Provider>

      <group visible={q.guides}>
        <Grid position={[0, -0.001, 0]} args={[10, 10]} cellSize={0.1} sectionSize={0.5} cellColor={gridCell} sectionColor={gridSection} fadeDistance={6} infiniteGrid />
      </group>
      {q.contactResolution > 0 && (
        <ContactShadow
          position={CONTACT_POS}
          opacity={0.35}
          // A passos (quatre per octava, cap amunt): editar les mides no refà els render targets a cada canvi.
          scale={2 ** (Math.ceil(Math.log2(Math.max(size.width, size.depth, 100) * S * 2.2) * 4) / 4)}
          blur={q.contactBlur}
          far={size.height * S + 0.5}
          resolution={q.contactResolution}
        />
      )}
      <CameraRig size={size} viewDir={viewDir} fitKey={fitKey} onFramedChange={onFramedChange} initialCamera={initialCamera} onCameraChange={onCameraChange} cameraGoto={cameraGoto} cameraFly={cameraFly} />
      {onSceneAccess && <SceneAccess onAccess={onSceneAccess} />}
    </Canvas>
  )
}

const ZERO3: [number, number, number] = [0, 0, 0]
const CONTACT_POS: [number, number, number] = [0, 0.0005, 0]
const DOWN: [number, number, number] = [0, -1, 0]
