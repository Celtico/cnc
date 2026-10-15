import { Box, Button, HStack, Icon, Text } from "@chakra-ui/react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { memo } from "react"
import { LuChevronDown, LuChevronRight } from "react-icons/lu"
import { DRAFT_KIND_LABEL, draftIcon } from "../../../core/model"
import { CASCADE_ICONS } from "./cascadeIcons"
import { NODE_W, type CascadeFlowNode } from "./cascadeFlow"

/** La vora segons el tipus: secció (gruixuda), opció (fina), tria (a ratlles). */
const KIND_BORDER = {
  section: { width: "2px", style: "solid", color: "fg.muted" },
  option: { width: "1px", style: "solid", color: "border.emphasized" },
  choice: { width: "1px", style: "dashed", color: "border.emphasized" },
} as const

const DOT = { added: "green.solid", changed: "purple.solid" } as const

/** Un puntet a la cantonada (diferència amb l'app, possible incoherència). */
function Dot({ color, side, title }: { color: string; side: "left" | "right"; title: string }) {
  return <Box position="absolute" top="-4px" {...{ [side]: "-4px" }} w="10px" h="10px" rounded="full" bg={color} borderWidth="2px" borderColor="bg.panel" title={title} />
}

/**
 * Un node del dibuix, senzill com el de l'usuari: una capsa arrodonida amb la icona i el nom al mig i una nansa a dalt (entra el
 * pare) i a sota (surten els fills). El tipus es veu a la vora; les diferències amb l'app i les incoherències, amb un
 * puntet; triat, la vora del color principal. A sota a la dreta, petit, plegar o desplegar la branca (també amb doble clic).
 */
function CascadeNodeView({ id, data, selected }: NodeProps<CascadeFlowNode>) {
  const { node, status, inside, collapsed, match, dropTarget } = data
  const k = KIND_BORDER[node.kind]
  const hot = selected || dropTarget
  const NodeIcon = CASCADE_ICONS[draftIcon(node)]
  return (
    <Box
      position="relative"
      w={`${NODE_W}px`}
      bg={dropTarget ? "wood.subtle" : "bg.panel"}
      color="fg"
      borderWidth={hot ? "2px" : k.width}
      borderStyle={hot ? "solid" : k.style}
      borderColor={hot ? "wood.solid" : k.color}
      rounded="lg"
      shadow={selected ? "md" : "xs"}
      outline={match ? "3px solid" : undefined}
      outlineColor={match ? "wood.muted" : undefined}
      px={5}
      py={2}
      textAlign="center"
      fontSize="sm"
      title={`${DRAFT_KIND_LABEL[node.kind]}: ${node.label}`}
    >
      <Handle type="target" position={Position.Top} />
      {status && <Dot color={DOT[status]} side="left" title={status === "added" ? "Nou (no és a l'app)" : "Canviat respecte de l'app"} />}
      {node.issue && <Dot color="orange.solid" side="right" title={`Revisar: ${node.issue}`} />}
      <HStack gap={1.5} justify="center">
        <Icon as={NodeIcon} boxSize={node.kind === "choice" ? 3 : 4} flexShrink={0} color={node.kind === "section" ? "wood.fg" : "fg.muted"} />
        <Text lineClamp={2} lineHeight="20px" minW={0} fontWeight={node.kind === "section" ? "semibold" : "normal"}>
          {node.label || "(sense nom)"}
        </Text>
      </HStack>
      {inside > 0 && (
        <Button
          className="nodrag nopan"
          position="absolute"
          right="2px"
          bottom="2px"
          size="2xs"
          h="16px"
          minW="16px"
          px={collapsed ? 1 : 0}
          variant="ghost"
          colorPalette="wood"
          color={collapsed ? "wood.fg" : "fg.subtle"}
          fontSize="2xs"
          gap={0.5}
          aria-label={collapsed ? `Desplegar (${inside} a dins)` : "Plegar"}
          title={collapsed ? `Desplegar (${inside} a dins)` : "Plegar"}
          aria-expanded={!collapsed}
          onClick={(e) => {
            e.stopPropagation()
            data.onToggle(id)
          }}
        >
          {collapsed ? <LuChevronRight /> : <LuChevronDown />}
          {collapsed && inside}
        </Button>
      )}
      <Handle type="source" position={Position.Bottom} />
    </Box>
  )
}

export const CascadeNode = memo(CascadeNodeView)
