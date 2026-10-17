import { Box } from "@chakra-ui/react"
import { Background, Controls, MiniMap, ReactFlow, type Edge, type EdgeChange, type NodeChange, type OnConnect, type OnDelete, type OnNodeDrag } from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { useColorMode } from "../../../components/ui/color-mode"
import { CascadeNode } from "./CascadeNode"
import type { CascadeFlowNode } from "./cascadeFlow"

const NODE_TYPES = { cascade: CascadeNode }

/** Els textos de React Flow, en català. */
const LABELS = {
  "node.a11yDescription.default": "Retorn o espai per triar el node. Supr per eliminar-lo i Esc per cancel·lar.",
  "node.a11yDescription.keyboardDisabled": "Retorn o espai per triar el node. Supr per eliminar-lo i Esc per cancel·lar.",
  "edge.a11yDescription.default": "Retorn o espai per triar la fletxa. Supr per eliminar-la i Esc per cancel·lar.",
  "controls.ariaLabel": "Zoom i encaixar",
  "controls.zoomIn.ariaLabel": "Apropar",
  "controls.zoomOut.ariaLabel": "Allunyar",
  "controls.fitView.ariaLabel": "Encaixar-ho tot",
  "controls.interactive.ariaLabel": "Bloquejar",
  "minimap.ariaLabel": "Minimapa",
  "handle.ariaLabel": "Nansa per unir",
}

/**
 * Els colors de React Flow amb els del tema (clar/fosc i la paleta `wood`): les variables `--xy-*` apunten als tokens
 * de Chakra.
 */
const THEME = {
  "--xy-background-color": "var(--chakra-colors-bg-muted)",
  "--xy-background-pattern-color": "var(--chakra-colors-border-emphasized)",
  "--xy-edge-stroke": "var(--chakra-colors-border-emphasized)",
  "--xy-edge-stroke-selected": "var(--chakra-colors-wood-solid)",
  "--xy-connectionline-stroke": "var(--chakra-colors-wood-solid)",
  "--xy-connectionline-stroke-width": "2",
  "--xy-handle-background-color": "var(--chakra-colors-wood-solid)",
  "--xy-handle-border-color": "var(--chakra-colors-bg-panel)",
  "--xy-node-boxshadow-selected": "none",
  "--xy-edge-label-background-color": "var(--chakra-colors-bg-panel)",
  "--xy-edge-label-color": "var(--chakra-colors-fg-muted)",
  "--xy-minimap-background-color": "var(--chakra-colors-bg-panel)",
  "--xy-minimap-mask-background-color": "color-mix(in srgb, var(--chakra-colors-bg-muted) 70%, transparent)",
  "--xy-minimap-node-background-color": "var(--chakra-colors-wood-muted)",
  "--xy-controls-button-background-color": "var(--chakra-colors-bg-panel)",
  "--xy-controls-button-background-color-hover": "var(--chakra-colors-bg-muted)",
  "--xy-controls-button-color": "var(--chakra-colors-fg)",
  "--xy-controls-button-color-hover": "var(--chakra-colors-fg)",
  "--xy-controls-button-border-color": "var(--chakra-colors-border)",
  "--xy-selection-background-color": "color-mix(in srgb, var(--chakra-colors-wood-solid) 10%, transparent)",
  "--xy-selection-border": "1px dashed var(--chakra-colors-wood-solid)",
  "& .react-flow__handle": { width: "9px", height: "9px" },
  "& .react-flow__edge-textbg": { fill: "var(--chakra-colors-bg-panel)" },
  "& .react-flow__edge-text": { fill: "var(--chakra-colors-fg-muted)", fontSize: "11px" },
  "& .react-flow__attribution": { display: "none" },
  "& .react-flow__controls": { borderRadius: "var(--chakra-radii-md)", overflow: "hidden" },
}

/**
 * El llenç de l'esborrany (React Flow): desplaçar i fer zoom (també amb els dits), el minimapa, «Encaixar» als controls.
 * Per organitzar: arrossegar nodes (amb Maj, triar-ne uns quants amb un requadre i moure'ls junts), unir de la nansa de
 * sota a la de dalt (fill), deixar un node a sobre d'un altre (fill) i esborrar amb Supr o ⌫. Doble clic a un node:
 * plegar o desplegar; al buit: un node nou.
 */
export function CascadeCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onDelete,
  onNodeDrag,
  onNodeDragStop,
  onNodeDoubleClick,
  onPaneDoubleClick,
}: {
  nodes: CascadeFlowNode[]
  edges: Edge[]
  onNodesChange: (changes: NodeChange<CascadeFlowNode>[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect: OnConnect
  onDelete: OnDelete<CascadeFlowNode, Edge>
  onNodeDrag: OnNodeDrag<CascadeFlowNode>
  onNodeDragStop: OnNodeDrag<CascadeFlowNode>
  onNodeDoubleClick: (id: string) => void
  onPaneDoubleClick: (client: { x: number; y: number }) => void
}) {
  const { colorMode } = useColorMode()
  return (
    <Box
      h="full"
      w="full"
      css={THEME}
      onDoubleClick={(e) => {
        if ((e.target as Element).classList.contains("react-flow__pane")) onPaneDoubleClick({ x: e.clientX, y: e.clientY })
      }}
    >
      <ReactFlow<CascadeFlowNode, Edge>
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDelete={onDelete}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onNodeDoubleClick={(_, n) => onNodeDoubleClick(n.id)}
        colorMode={colorMode === "dark" ? "dark" : "light"}
        zoomOnDoubleClick={false}
        deleteKeyCode={["Delete", "Backspace"]}
        minZoom={0.1}
        maxZoom={2}
        onlyRenderVisibleElements
        fitView
        fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
        proOptions={{ hideAttribution: true }}
        ariaLabelConfig={LABELS}
      >
        <Background gap={24} size={1.5} />
        <Controls showInteractive={false} position="bottom-left" />
        <MiniMap pannable zoomable position="bottom-right" nodeBorderRadius={4} style={{ width: 160, height: 110 }} />
      </ReactFlow>
    </Box>
  )
}
