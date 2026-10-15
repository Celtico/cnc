import type { Hole, Panel, Vec3 } from "../../model"

export interface HardwareMount {
  /** Peces que es dibuixen (coordenades del mòdul, mm: X amplada, Y amunt, Z cap al davant). */
  panels: Panel[]
  /** Importat sense confirmar: els forats amb aquestes etiquetes encara no es fan (proposta). */
  pending: boolean
  proposedTags: string[]
  /** Etiquetes dels forats del ferratge (els altres, com la filera System 32, són del moble). */
  tags: string[]
  /** Forat principal (el centre de l'entrada, mm del mòdul) i la normal de la cara on entra (cap a fora de la peça). */
  focus: { panelId: string; hole: Hole; at: Vec3; normal: Vec3; /** D'on es mira al 3D, si no és la normal (un tirador: des de fora del front). */ view?: Vec3; /** `view` tal qual, sense apartar-se de costat (un joc de calaix: des de dins i del darrere). */ exact?: boolean } | null
  /** Frontissa (o placa): la porta i el lateral, i a quin costat (sempre l'esquerre). */
  hinge?: { doorId: string; sideId: string }
  /** Mides del mòdul d'exemple (mm). */
  size: { width: number; height: number; depth: number }
  /** Avisos del motor que toquen aquest ferratge (p. ex. una placa amb un forat fora del lateral). */
  warnings: string[]
  error?: string
  /**
   * Un accessori sense cap forat (barra, perfil LED, marc): on es talla el pla (`mountPlan`, el mig del primer que es
   * veu) i, si no és la de sempre, d'on es mira (`view`: la barra i el perfil LED, de davant i una mica de sota, que la
   * tapa els tapa des de dalt). La càmera enquadra `region`.
   */
  aim?: { at: Vec3; view?: Vec3 }
  /** Es mira sencer encara que sigui gran (un electrodomèstic amb el seu front): la càmera s'allunya el que calgui. */
  whole?: boolean
  /** Ferratge «només 3D» (motor `model`): cap peça ni forat, només el model (o la seva caixa) per veure'l. */
  model?: { asset?: string; bbox?: { min: Vec3; max: Vec3 } }
  /**
   * El que ha de sortir a la imatge (coordenades del mòdul, mm): el ferratge (el model o el volum simplificat), els forats
   * que fa i un marge de peça al voltant (`mountCamera` hi fa cabre la càmera exactament). A les frontisses, la de baix
   * amb la placa; a una pota, la pota i la cantonada de la base; als jocs, les guies i els perfils, tot el llarg.
   */
  region: { min: Vec3; max: Vec3 }
  /**
   * Les peces que són el ferratge (components d'un joc, perfils i barra d'un accessori): es dibuixen opaques. La resta és
   * fusta, que «Com va muntat» i la miniatura dibuixen translúcida perquè el ferratge sigui el protagonista.
   */
  solid: string[]
}

export type Box = { min: Vec3; max: Vec3 }
