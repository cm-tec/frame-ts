import { useState, useRef, useEffect } from "react";
import { Stage, Layer, Circle, Line } from "react-konva";
import Konva from "konva";
import { SystemSolution } from "./SystemSolver";
import MatrixLineChart from "./chart";


export default function SolutionVisualization({ systemSolution }: { systemSolution: SystemSolution }) {
    const [currentTime, setCurrentTime] = useState(0);
    const [speed, setSpeed] = useState(1);
    const [isRunning, setIsRunning] = useState(true);

    const animRef = useRef<Konva.Animation | null>(null);

    const stageRef = useRef<any>(null);

    const circleRef1 = useRef<any>(null);
    const circleRef2 = useRef<any>(null);

    const lineRef1 = useRef<any>(null);
    const lineRef2 = useRef<any>(null);



    const [stageSize, setStageSize] = useState({ width: window.innerWidth, height: window.innerHeight });

    // Canvas size
    const width = stageSize.width;
    const height = stageSize.height / 2;




    useEffect(() => {
        const handleResize = () => setStageSize({ width: window.innerWidth, height: window.innerHeight });
        window.addEventListener("resize", handleResize);

        // Create animation
        const anim = new Konva.Animation((frame) => {
            if (!frame) return;
            let t = speed * frame.time / 1000;

            runFrame(t)
        }, stageRef.current?.getStage()?.children[0]);

        anim.start();
        animRef.current = anim;

        return () => {
            window.removeEventListener("resize", handleResize);
            anim.stop();
        };
    }, []);

    // Pause animation
    const pauseAnimation = () => {
        animRef.current?.stop();
        setIsRunning(false);
    };

    // Resume animation
    const resumeAnimation = () => {
        animRef.current?.start();
        setIsRunning(true);
    };

    const runFrame = (t: number) => {
        setCurrentTime(t);

        const w1 = systemSolution.get_w(0, t);
        const w2 = systemSolution.get_w(1, t);

        const x1 = 650 + w1 * 100;
        const x2 = 350 + w2 * 100;
        if (circleRef1.current) circleRef1.current.x(x1);
        if (circleRef2.current) circleRef2.current.x(x2);
        if (lineRef1.current) {
            lineRef1.current.points([10, 50, x1, 50]);
        }
        if (lineRef2.current) {
            lineRef2.current.points([x1, 50, x2, 50]);
        }
    };

    // Restart animation
    const restartAnimation = () => {
        animRef.current?.stop();

        const anim = new Konva.Animation((frame) => {
            if (!frame) return;
            let t = speed * frame.time / 1000;

            runFrame(t)
        }, stageRef.current?.getStage()?.children[0]);

        animRef.current = anim;


        if (isRunning) {
            animRef.current?.start();
        } else {
            runFrame(0);
        }

    };

    return (
        <>
            <p>{currentTime.toFixed(2)} s</p>
            <input name="age" type="number" value={speed} onChange={(e) => setSpeed(Number(e.target.value))} />
            <button onClick={isRunning ? pauseAnimation : resumeAnimation}>
                {isRunning ? "Pause" : "Resume"}
            </button>
            <button onClick={restartAnimation}>Restart</button>



            <Stage width={width} height={height} ref={stageRef}>
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

            <MatrixLineChart matrixData={systemSolution.get_w_history(0, 300, 50)} currentTime={currentTime} />
        </>
    );
}

