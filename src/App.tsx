import React, { useState, useRef, useEffect } from "react";
import { Stage, Layer, Circle, Line, Arrow, Group } from "react-konva";
import { bernoulli_beam, Point } from "./models";

interface LineLoadProps {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  loadMagnitude: number; // controls arrow length
  numArrows?: number;    // how many arrows along the line
}

export const LineLoad: React.FC<LineLoadProps> = ({
  startX,
  startY,
  endX,
  endY,
  loadMagnitude,
  numArrows = 5
}) => {
  const points: { x: number; y: number }[] = [];

  // Compute arrows positions along the line
  for (let i = 0; i <= numArrows; i++) {
    const t = i / numArrows;
    const x = startX + (endX - startX) * t;
    const y = startY + (endY - startY) * t;
    points.push({ x, y });
  }

  // Compute line angle
  const dx = endX - startX;
  const dy = endY - startY;
  const angle = Math.atan2(dy, dx);

  // Arrow offset perpendicular to the line (optional, if you want arrows "above" the beam)
  const offset = 0; // you can set to e.g., -10

  return (
    <Group>
      {points.map((p, i) => {
        // Arrow points
        const arrowLength = loadMagnitude;
        // Arrow pointing perpendicular to beam (downwards)
        const perpAngle = angle - Math.PI / 2;
        const endX = p.x + arrowLength * Math.cos(perpAngle);
        const endY = p.y + arrowLength * Math.sin(perpAngle);

        return (
          <Arrow
            key={i}
            points={[p.x, p.y, endX, endY]}
            stroke="red"
            fill="red"
            pointerLength={10}
            pointerWidth={8}
            strokeWidth={2}
            draggable={true}
          />
        );
      })}
    </Group>
  );
};


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
    y: height - (p.y * scale_y + offset_y),
  });

  const [pos, setPos] = useState<Point>(new Point(50, 50));


  useEffect(() => {
    const handleResize = () => setStageSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleVerticalDragMove = (e: any) => {
    e.target.x(e.target.y());

  };

  return (
    <Stage width={width} height={height} ref={stageRef}>
      <Layer>
        <Circle
          x={pos.x}
          y={pos.y}
          radius={20}
          fill={"red"}
          draggable
          onDragMove={handleVerticalDragMove}
        />



      </Layer>
    </Stage >
  );
}
