import { useLayoutEffect, useRef, type RefObject } from "react"

/**
 * La darrera versió d'un valor en una ref, per llegir-la des d'un callback, un temporitzador o un efecte sense posar-la a
 * les dependències (i sense tornar a crear el callback a cada render). S'actualitza després de cada render, abans dels
 * efectes i dels esdeveniments: **no la llegeixis durant el render** (allà fes servir el valor directament).
 */
export function useLatest<T>(value: T): RefObject<T> {
  const ref = useRef(value)
  useLayoutEffect(() => {
    ref.current = value
  })
  return ref
}
