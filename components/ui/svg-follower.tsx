"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Position {
  x: number;
  y: number;
}

interface Point {
  position: Position;
  time: number;
  drift: Position;
  age: number;
  direction: Position;
}

interface SVGFollowerProps {
  width?: number | string;
  height?: number | string;
  colors?: string[];
  removeDelay?: number;
  autoPlay?: boolean;
  className?: string;
}

class Follower {
  private points: Point[] = [];
  private line: SVGPathElement;
  private stage: SVGSVGElement;
  private color: string;
  private removeDelay: number;

  constructor(stage: SVGSVGElement, color: string, removeDelay: number) {
    this.stage = stage;
    this.color = color;
    this.removeDelay = removeDelay;
    this.line = document.createElementNS("http://www.w3.org/2000/svg", "path");
    this.line.style.fill = color;
    this.line.style.stroke = color;
    this.line.style.strokeWidth = "1";
    this.stage.appendChild(this.line);
  }

  private getDrift(): number {
    return (Math.random() - 0.5) * 3;
  }

  add(position: Position) {
    const direction = { x: 0, y: 0 };

    if (this.points[0]) {
      direction.x = (position.x - this.points[0].position.x) * 0.25;
      direction.y = (position.y - this.points[0].position.y) * 0.25;
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
    };

    const shapeChance = Math.random();
    const chance = 0.08;

    if (shapeChance < chance) this.makeCircle(point);
    else if (shapeChance < chance * 2) this.makeSquare(point);
    else if (shapeChance < chance * 3) this.makeTriangle(point);

    this.points.unshift(point);
  }

  private createLine(points: Point[]): string {
    const path: string[] = [points.length ? "M" : ""];

    if (points.length > 0) {
      let forward = true;
      let i = 0;

      while (i >= 0) {
        const point = points[i];
        const offsetX = point.direction.x * ((i - points.length) / points.length) * 0.6;
        const offsetY = point.direction.y * ((i - points.length) / points.length) * 0.6;
        const x = point.position.x + (forward ? offsetY : -offsetY);
        const y = point.position.y + (forward ? offsetX : -offsetX);
        point.age += 0.2;

        path.push(String(x + point.drift.x * point.age));
        path.push(String(y + point.drift.y * point.age));

        i += forward ? 1 : -1;
        if (i === points.length) {
          i -= 1;
          forward = false;
        }
      }
    }

    return path.join(" ");
  }

  trim() {
    if (this.points.length > 0) {
      const now = Date.now();
      while (this.points.length > 0 && this.points[this.points.length - 1].time < now - this.removeDelay) {
        this.points.pop();
      }
    }

    this.line.setAttribute("d", this.createLine(this.points));
  }

  destroy() {
    if (this.stage.contains(this.line)) {
      this.stage.removeChild(this.line);
    }
  }

  private makeCircle(point: Point) {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    const radius = Math.max((Math.abs(point.direction.x) + Math.abs(point.direction.y)) * 1, 1.6);
    circle.setAttribute("r", String(radius));
    circle.style.fill = this.color;
    circle.setAttribute("cx", "0");
    circle.setAttribute("cy", "0");
    this.moveShape(circle, point);
  }

  private makeSquare(point: Point) {
    const size = Math.max((Math.abs(point.direction.x) + Math.abs(point.direction.y)) * 1.5, 2);
    const square = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    square.setAttribute("width", String(size));
    square.setAttribute("height", String(size));
    square.style.fill = this.color;
    this.moveShape(square, point);
  }

  private makeTriangle(point: Point) {
    const size = Math.max((Math.abs(point.direction.x) + Math.abs(point.direction.y)) * 1.5, 2);
    const triangle = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    triangle.setAttribute("points", `0,0 ${size},${size / 2} 0,${size}`);
    triangle.style.fill = this.color;
    this.moveShape(triangle, point);
  }

  private moveShape(shape: SVGElement, point: Point) {
    this.stage.appendChild(shape);
    const driftX = point.position.x + point.direction.x * (Math.random() * 20) + point.drift.x * (Math.random() * 10);
    const driftY = point.position.y + point.direction.y * (Math.random() * 20) + point.drift.y * (Math.random() * 10);

    shape.style.transform = `translate(${point.position.x}px, ${point.position.y}px)`;
    shape.style.transition = "all 0.45s ease-out";

    setTimeout(() => {
      shape.style.transform = `translate(${driftX}px, ${driftY}px) scale(0) rotate(${Math.random() * 360}deg)`;

      setTimeout(() => {
        if (this.stage.contains(shape)) {
          this.stage.removeChild(shape);
        }
      }, 450);
    }, 10);
  }
}

export function SVGFollower({
  width = "100%",
  height = "100%",
  colors = ["#ff6b6b", "#4dabf7", "#51cf66", "#ffd43b", "#ffffff"],
  removeDelay = 400,
  autoPlay = false,
  className = "",
}: SVGFollowerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const followersRef = useRef<Follower[]>([]);
  const animationRef = useRef<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const recordingRef = useRef<Position[]>([]);
  const pointerRef = useRef<Position | null>(null);
  const smoothPointerRef = useRef<Position | null>(null);
  const [size, setSize] = useState({ width: 1, height: 1 });

  const animate = useCallback(() => {
    const target = pointerRef.current;

    if (target) {
      if (!smoothPointerRef.current) {
        smoothPointerRef.current = { ...target };
      }

      smoothPointerRef.current.x += (target.x - smoothPointerRef.current.x) * 0.34;
      smoothPointerRef.current.y += (target.y - smoothPointerRef.current.y) * 0.34;

      followersRef.current.forEach((follower) => follower.add(smoothPointerRef.current as Position));

      if (isRecording) {
        recordingRef.current.push({
          x: (smoothPointerRef.current.x / size.width) * 100,
          y: (smoothPointerRef.current.y / size.height) * 100,
        });
      }
    } else if (autoPlay) {
      const now = performance.now() * 0.001;
      const autoPoint = {
        x: size.width * (0.5 + Math.cos(now * 0.75) * 0.28),
        y: size.height * (0.5 + Math.sin(now * 1.05) * 0.28),
      };
      followersRef.current.forEach((follower) => follower.add(autoPoint));
    }

    followersRef.current.forEach((follower) => follower.trim());
    animationRef.current = requestAnimationFrame(animate);
  }, [autoPlay, isRecording, size.height, size.width]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      setSize({ width: Math.max(rect.width, 1), height: Math.max(rect.height, 1) });
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      pointerRef.current = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    };

    const handlePointerDown = () => {
      recordingRef.current = [];
      setIsRecording(true);
    };

    const handlePointerUp = () => {
      setIsRecording(false);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, []);

  useEffect(() => {
    if (!svgRef.current) return;

    followersRef.current.forEach((follower) => follower.destroy());
    followersRef.current = colors.map((color) => new Follower(svgRef.current as SVGSVGElement, color, removeDelay));

    return () => {
      followersRef.current.forEach((follower) => follower.destroy());
      followersRef.current = [];
    };
  }, [colors, removeDelay]);

  useEffect(() => {
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [animate]);

  return (
    <div
      ref={containerRef}
      className={`pointer-events-none relative overflow-hidden ${className}`}
      aria-hidden
    >
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 ${size.width} ${size.height}`}
        xmlns="http://www.w3.org/2000/svg"
        className="absolute inset-0"
      />
    </div>
  );
}
