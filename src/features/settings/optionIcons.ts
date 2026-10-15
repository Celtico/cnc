import type { IconType } from "react-icons"
import { LuAlignCenterVertical, LuArchive, LuBolt, LuBox, LuColumns2, LuDoorClosed, LuFactory, LuFrame, LuGroup, LuLampFloor, LuLayers, LuLink, LuListTree, LuMousePointerClick, LuMove, LuMoveDiagonal, LuPalette, LuPuzzle, LuRefrigerator, LuRows3, LuScan, LuScissors, LuSettings2, LuSpline, LuSprout, LuSquareSplitHorizontal, LuWrench } from "react-icons/lu"
import type { OptionIcon } from "../../core/model"
import { ORIENT_ICON } from "../composition/partOrient"

/**
 * Icona de cada secció de l'arbre de Preferències › Opcions en cascada: les de l'inspector (Posició, Mides, Caixa, Portes,
 * Unió, Materials, Front, Prestatges i accessoris…) i les de l'arbre de l'Editor (el moble, les peces, els objectes).
 */
export const OPTION_ICONS: Record<OptionIcon, IconType> = {
  structure: LuListTree,
  moble: LuBox,
  module: LuArchive,
  zone: LuLayers,
  part: ORIENT_ICON.front,
  ref: LuScan,
  multi: LuMousePointerClick,
  summary: LuBox,
  joinery: LuPuzzle,
  scene: LuLampFloor,
  materials: LuPalette,
  position: LuMove,
  dims: LuMoveDiagonal,
  appliance: LuRefrigerator,
  carcass: LuFrame,
  doors: LuDoorClosed,
  joint: LuBolt,
  front: LuDoorClosed,
  shelves: LuRows3,
  divide: LuSquareSplitHorizontal,
  split: LuColumns2,
  subsection: LuSettings2,
  effect: LuScissors,
  orient: ORIENT_ICON.front,
  shape: LuSpline,
  cnc: LuFactory,
  group: LuGroup,
  attach: LuLink,
  hardware: LuWrench,
  align: LuAlignCenterVertical,
  items: LuSprout,
}
