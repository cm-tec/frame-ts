import React, { useState, useRef, useEffect } from "react";
import { Stage, Layer, Circle, Line } from "react-konva";
import { vec2 } from "gl-matrix";
import { bernoulli_beam, Point } from "./models";

// ---------- React Component ----------

export default function App() {
  const stageRef = useRef<any>(null);
  const [hoveredNode, setHoveredNode] = useState<Point | null>(null);

  const [stageSize, setStageSize] = useState({ width: window.innerWidth, height: window.innerHeight });


  const margin = 0.1; // 10% margin

  // Canvas size
  const width = stageSize.width;
  const height = stageSize.height;

  // Compute scale and offset to fit system
  const scale_x = (1 - 2 * margin) * width / bernoulli_beam.width();
  const scale_y = (1 - 2 * margin) * height / bernoulli_beam.height();


  const offset_x = -bernoulli_beam.min_x() * scale_x + margin * width;
  const offset_y = -bernoulli_beam.min_y() * scale_y + margin * height;

  // Transform system coordinates to canvas coordinates
  const transform = (p: Point) => ({
    x: p.x * scale_x + offset_x,
    y: p.y * scale_y + offset_y,
  });

  useEffect(() => {
    const handleResize = () => setStageSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);


  return (
    <Stage width={width} height={height} ref={stageRef}>
      <Layer>
        {/* Draw elements */}
        {bernoulli_beam.elements.map((el, i) => {
          const pA = transform(el.point_a);
          const pB = transform(el.point_b);
          return (
            <Line
              key={i}
              points={[pA.x, pA.y, pB.x, pB.y]}
              stroke="#1f6feb"
              strokeWidth={4}
            />
          );
        })}

        {/* Draw nodes */}
        {bernoulli_beam.nodes.map((n, i) => {
          const canvasP = transform(n.point);
          const isHovered = hoveredNode === n.point;
          return (
            <Circle
              key={i}
              x={canvasP.x}
              y={canvasP.y}
              radius={isHovered ? 10 : 6}
              fill={isHovered ? "red" : "#ff5500"}
              onMouseEnter={() => setHoveredNode(n.point)}
              onMouseLeave={() => setHoveredNode(null)}
              onClick={() => console.log("Clicked node", n.point)}
            />

          )
        })}
      </Layer>
    </Stage>
  );
}
