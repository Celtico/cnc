import { Badge, Box, Button, HStack, Text } from "@chakra-ui/react"
import { Handle, type NodeProps } from "@xyflow/react"
import { createElement, memo } from "react"
import { LuChevronDown, LuChevronRight, LuStickyNote, LuTriangleAlert } from "react-icons/lu"
import { DRAFT_KIND_LABEL } from "../../../core/model"
import { NODE_W, nodeIcon, type CascadeFlowNode } from "./cascadeFlow"

const STATUS = {
  added: { label: "Nou", palette: "green", border: "green.solid" },
  changed: { label: "Canviat", palette: "purple", border: "purple.solid" },
} as const

/**
 * Un node del dibuix de la cascada: icona, tipus (Secció · Opció · Tria), nom i «Surt quan». Les marques: «Nou» /
 * «Canviat» (diferent de l'app), la possible incoherència (taronja) i la nota. El botó de la dreta plega o desplega la
 * branca i diu quants en té a dins (també amb doble clic al node).
 */
function CascadeNodeView({ id, data, selected, sourcePosition, targetPosition }: NodeProps<CascadeFlowNode>) {
  const { node, status, inside, collapsed, match } = data
  const st = status ? STATUS[status] : undefined
  return (
    <Box
      w={`${NODE_W}px`}
      bg={node.kind === "choice" ? "bg.subtle" : "bg.panel"}
      color="fg"
      borderWidth={selected || st ? "2px" : "1px"}
      borderStyle={node.kind === "choice" ? "dashed" : "solid"}
      borderColor={selected ? "wood.solid" : (st?.border ?? (match ? "wood.emphasized" : "border.emphasized"))}
      rounded={node.kind === "choice" ? "xl" : "md"}
      shadow={selected ? "md" : "xs"}
      outline={match ? "3px solid" : undefined}
      outlineColor={match ? "wood.muted" : undefined}
      px={node.kind === "choice" ? 3.5 : 2.5}
      py={2}
      fontSize="sm"
    >
      <Handle type="target" position={targetPosition!} />
      <HStack gap={1.5} minH="22px">
        <Box color="wood.fg" display="inline-flex" flexShrink={0}>
          {createElement(nodeIcon(node))}
        </Box>
        <Text fontSize="2xs" textTransform="uppercase" letterSpacing="wide" color="fg.muted" flexShrink={0}>
          {DRAFT_KIND_LABEL[node.kind]}
        </Text>
        {st && (
          <Badge size="xs" colorPalette={st.palette} variant="solid">
            {st.label}
          </Badge>
        )}
        {node.issue && (
          <Badge size="xs" colorPalette="orange" variant="solid" title={node.issue}>
            <LuTriangleAlert /> Revisar
          </Badge>
        )}
        {node.note && (
          <Box color="fg.muted" display="inline-flex" title={node.note}>
            <LuStickyNote />
          </Box>
        )}
        <Box flex={1} />
        {inside > 0 && (
          <Button
            className="nodrag nopan"
            size="2xs"
            variant={collapsed ? "subtle" : "ghost"}
            colorPalette="wood"
            px={1}
            minW={0}
            aria-label={collapsed ? `Desplegar (${inside} a dins)` : "Plegar"}
            title={collapsed ? `Desplegar (${inside} a dins)` : "Plegar"}
            aria-expanded={!collapsed}
            onClick={(e) => {
              e.stopPropagation()
              data.onToggle(id)
            }}
          >
            {collapsed ? <LuChevronRight /> : <LuChevronDown />}
            {collapsed && <Text as="span">{inside}</Text>}
          </Button>
        )}
      </HStack>
      <Text fontWeight="medium" lineClamp={2} lineHeight="20px">
        {node.label || "(sense nom)"}
      </Text>
      {node.when && (
        <Text fontSize="xs" color="fg.muted" lineClamp={3} lineHeight="16px">
          Surt quan: {node.when}
        </Text>
      )}
      <Handle type="source" position={sourcePosition!} />
    </Box>
  )
}

export const CascadeNode = memo(CascadeNodeView)
