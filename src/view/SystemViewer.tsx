
import { Stage, Layer, Circle, Line } from "react-konva";
import type { SystemSolution } from "../SystemSolver";
import { useState } from "react";

export default function SolutionVisualization({ systemSolution }: { systemSolution: SystemSolution }) {
    const [stageSize, setStageSize] = useState({ width: window.innerWidth, height: window.innerHeight });

    const width = stageSize.width;
    const height = stageSize.height;




    return (
        <Stage width={width} height={0.8 * height} ref={stageRef}>
            <Layer>
                <Line ref={lineRef1} stroke="black" strokeWidth={10} />
                <Line ref={lineRef2} stroke="gray" strokeWidth={10} />
                <Circle
                    ref={circleRef1}
                    y={50}
                    radius={25}
                    fill={"red"}
                />
                <Circle
                    ref={circleRef2}
                    y={50}
                    radius={15}
                    fill={"blue"}
                />
            </Layer>
        </Stage>
    );
}

