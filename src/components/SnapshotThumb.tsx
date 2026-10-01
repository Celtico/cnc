import { Box } from "@chakra-ui/react"

/**
 * Miniatura feta foto (3D) d'una targeta. Fa 2:1, la mateixa proporció que la imatge (`thumbRenderer`): així no se'n
 * retalla res, sigui quina sigui l'amplada de la targeta. Sense foto encara, el mateix requadre buit (no un dibuix
 * d'una altra mida): la graella no salta mentre es van fent. Sense fons: les transparents (ambients) deixen veure la
 * targeta.
 */
export function SnapshotThumb({ src }: { src?: string | null }) {
  return (
    <Box aspectRatio="2 / 1" rounded="md" overflow="hidden" bg={src ? undefined : "bg.muted"}>
      {src && <img src={src} alt="" loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />}
    </Box>
  )
}
