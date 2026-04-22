"use client"

import type React from "react"
import { useRef, useEffect, useCallback } from "react"

interface Position {
  x: number
  y: number
}

interface Point {
  position: Position
  time: number
  drift: Position
  age: number
  direction: Position
}

interface SVGFollowerProps {
  colors?: string[]
  removeDelay?: number
  className?: string
}

export function SVGFollower({
  colors = ["red", "blue", "green"],
  removeDelay = 400,
  className = "",
}: SVGFollowerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const followersRef = useRef<Follower[]>([])
  const animationRef = useRef<number | null>(null)

  const isRecordingRef = useRef(false)
  const recordingRef = useRef<Position[]>([])

  class Follower {
    private points: Point[] = []
    private line: SVGPathElement
    private color: string
    private stage: SVGSVGElement

    constructor(stage: SVGSVGElement, color: string) {
      this.stage = stage
      this.color = color

      this.line = document.createElementNS("http://www.w3.org/2000/svg", "path")
      this.line.style.fill = color
      this.line.style.stroke = color
      this.line.style.strokeWidth = "1"

      this.stage.appendChild(this.line)
    }

    private getDrift() {
      return (Math.random() - 0.5) * 3
    }

    public add(position: Position) {
      const direction = { x: 0, y: 0 }

      if (this.points[0]) {
        direction.x = (position.x - this.points[0].position.x) * 0.25
        direction.y = (position.y - this.points[0].position.y) * 0.25
      }

      const point: Point = {
        position,
        time: Date.now(),
        drift: {
          x: this.getDrift() + direction.x / 2,
          y: this.getDrift() + direction.y / 2,
        },
        age: 0,
        direction,
      }

      // 🔥 reduced shape frequency (performance fix)
      if (Math.random() < 0.05) {
        const type = Math.random()
        if (type < 0.33) this.makeCircle(point)
        else if (type < 0.66) this.makeSquare(point)
        else this.makeTriangle(point)
      }

      this.points.unshift(point)
    }

    private createLine(points: Point[]) {
      const path: string[] = [points.length ? "M" : ""]

      if (points.length > 0) {
        let forward = true
        let i = 0

        while (i >= 0) {
          const p = points[i]

          const offsetX =
            p.direction.x * ((i - points.length) / points.length) * 0.6
          const offsetY =
            p.direction.y * ((i - points.length) / points.length) * 0.6

          const x = p.position.x + (forward ? offsetY : -offsetY)
          const y = p.position.y + (forward ? offsetX : -offsetX)

          p.age += 0.2

          path.push(String(x + p.drift.x * p.age))
          path.push(String(y + p.drift.y * p.age))

          i += forward ? 1 : -1

          if (i === points.length) {
            i--
            forward = false
          }
        }
      }

      return path.join(" ")
    }

    public trim() {
      if (this.points.length > 0) {
        const last = this.points[this.points.length - 1]
        if (last.time < Date.now() - removeDelay) {
          this.points.pop()
        }
      }

      this.line.setAttribute("d", this.createLine(this.points))
    }

    private makeCircle(point: Point) {
      const el = document.createElementNS("http://www.w3.org/2000/svg", "circle")
      const r = Math.abs(point.direction.x) + Math.abs(point.direction.y)
      el.setAttribute("r", String(r))
      el.style.fill = this.color
      this.animateShape(el, point)
    }

    private makeSquare(point: Point) {
      const size = (Math.abs(point.direction.x) + Math.abs(point.direction.y)) * 1.5
      const el = document.createElementNS("http://www.w3.org/2000/svg", "rect")
      el.setAttribute("width", String(size))
      el.setAttribute("height", String(size))
      el.style.fill = this.color
      this.animateShape(el, point)
    }

    private makeTriangle(point: Point) {
      const size = (Math.abs(point.direction.x) + Math.abs(point.direction.y)) * 1.5
      const el = document.createElementNS("http://www.w3.org/2000/svg", "polygon")
      el.setAttribute("points", `0,0 ${size},${size / 2} 0,${size}`)
      el.style.fill = this.color
      this.animateShape(el, point)
    }

    private animateShape(shape: SVGElement, point: Point) {
      this.stage.appendChild(shape)

      const driftX = point.position.x + point.drift.x * 20
      const driftY = point.position.y + point.drift.y * 20

      shape.style.transform = `translate(${point.position.x}px, ${point.position.y}px)`
      shape.style.transition = "all 0.5s ease-out"

      requestAnimationFrame(() => {
        shape.style.transform = `translate(${driftX}px, ${driftY}px) scale(0)`
      })

      setTimeout(() => {
        shape.remove()
      }, 500)
    }
  }

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return

    const position = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }

    followersRef.current.forEach((f) => f.add(position))

    if (isRecordingRef.current) recordingRef.current.push(position)
  }, [])

  const animate = useCallback(() => {
    followersRef.current.forEach((f) => f.trim())
    animationRef.current = requestAnimationFrame(animate)
  }, [])

  useEffect(() => {
    if (!svgRef.current) return

    followersRef.current = colors.map(
      (c) => new Follower(svgRef.current!, c)
    )

    window.addEventListener("mousemove", handleMouseMove)
    animate()

    const svgEl = svgRef.current

    return () => {
      window.removeEventListener("mousemove", handleMouseMove)

      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current)
      }

      svgEl?.replaceChildren()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colors, animate, handleMouseMove])

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 ${className}`}
    >
      <svg
        ref={svgRef}
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      />
    </div>
  )
}