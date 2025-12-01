import { useState, useRef, useEffect } from "react";
import { Stage, Layer, Circle } from "react-konva";
import Konva from "konva";
import { SystemSolution } from "./SystemSolver";
import MatrixLineChart from "./chart";


export default function SolutionVisualization({ systemSolution }: { systemSolution: SystemSolution }) {

    const [currentTime, setCurrentTime] = useState(0);

    const stageRef = useRef<any>(null);

    const circleRef1 = useRef<any>(null);
    const circleRef2 = useRef<any>(null);


    const [stageSize, setStageSize] = useState({ width: window.innerWidth, height: window.innerHeight });

    // Canvas size
    const width = stageSize.width;
    const height = stageSize.height / 2;

    useEffect(() => {
        const handleResize = () => setStageSize({ width: window.innerWidth, height: window.innerHeight });
        window.addEventListener("resize", handleResize);

        const anim = new Konva.Animation((frame) => {
            let i = frame.time / 1000;
            setCurrentTime(i);

            let w1: number = systemSolution.get_w(0, i);
            let w2: number = systemSolution.get_w(1, i);

            circleRef1.current!.x(650 + w1 * 100);
            circleRef2.current!.x(350 + w2 * 100);
        }, [circleRef1.current!.getLayer(), circleRef2.current!.getLayer()]);

        anim.start();


        return () => {
            window.removeEventListener("resize", handleResize);
            anim.stop();
        };
    }, []);

    const handleVerticalDragMove = (e: any) => {
        e.target.x(e.target.y());

    };


    return (
        <>
            <p>{currentTime} s</p>
            <Stage width={width} height={height} ref={stageRef}>
                <Layer>
                    <Circle
                        ref={circleRef1}
                        y={50}
                        radius={25}
                        fill={"red"}
                        draggable
                        onDragMove={handleVerticalDragMove}
                    />
                    <Circle
                        ref={circleRef2}
                        y={50}
                        radius={15}
                        fill={"blue"}
                        draggable
                        onDragMove={handleVerticalDragMove}
                    />
                </Layer>
            </Stage >

            <MatrixLineChart matrixData={systemSolution.get_w_history(0, 200, 100)} currentTime={currentTime} />
        </>
    );
}




