import { Html, Line } from "@react-three/drei";
import { Fragment } from "react";
import type { SketchLine } from "../facePick";
import { S } from "./constants";

const COLOR: Record<SketchLine["tone"], string> = {
  sketch: "#1971c2",
  selected: "#e8590c",
  draft: "#2f9e44",
};

/** Els croquis de Modelatge (com les línies de l'Esbós del Taulell), per sobre de les peces; els punts sols, una boleta. */
export function SketchLines({ lines }: { lines: SketchLine[] }) {
  return (
    <>
      {lines.map((l, i) =>
        l.box ? (
          <Fragment key={i}>
            <mesh
              position={[
                ((l.box.min[0] + l.box.max[0]) / 2) * S,
                ((l.box.min[1] + l.box.max[1]) / 2) * S,
                ((l.box.min[2] + l.box.max[2]) / 2) * S,
              ]}
              renderOrder={19}
              raycast={() => null}
            >
              <boxGeometry
                args={[
                  (l.box.max[0] - l.box.min[0]) * S,
                  (l.box.max[1] - l.box.min[1]) * S,
                  (l.box.max[2] - l.box.min[2]) * S,
                ]}
              />
              <meshBasicMaterial
                color={COLOR.draft}
                transparent
                opacity={0.45}
                depthWrite={false}
              />
            </mesh>
            {l.label && (
              <Html
                position={[
                  ((l.box.min[0] + l.box.max[0]) / 2) * S,
                  ((l.box.min[1] + l.box.max[1]) / 2) * S,
                  ((l.box.min[2] + l.box.max[2]) / 2) * S,
                ]}
                center
                zIndexRange={[30, 20]}
                style={{ pointerEvents: "none" }}
              >
                <div
                  style={{
                    transform: "translateY(-28px)",
                    whiteSpace: "nowrap",
                    font: "12px ui-monospace, monospace",
                    padding: "3px 8px",
                    borderRadius: 4,
                    background: "rgba(245,245,240,0.92)",
                    color: "#1a222b",
                  }}
                >
                  {l.label}
                </div>
              </Html>
            )}
          </Fragment>
        ) : l.pts.length < 2 ? (
          l.pts.map((p, k) => (
            <mesh
              key={`${i}-${k}`}
              position={[p[0] * S, p[1] * S, p[2] * S]}
              renderOrder={20}
            >
              <sphereGeometry args={[4 * S, 12, 8]} />
              <meshBasicMaterial color={COLOR[l.tone]} depthTest={false} />
            </mesh>
          ))
        ) : (
          <Line
            key={i}
            points={(l.closed ? [...l.pts, l.pts[0]!] : l.pts).map(
              (p) => [p[0] * S, p[1] * S, p[2] * S] as [number, number, number],
            )}
            color={COLOR[l.tone]}
            lineWidth={l.tone === "sketch" ? 2 : 3}
            depthTest={false}
            renderOrder={20}
          />
        ),
      )}
    </>
  );
}
