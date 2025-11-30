import { useState, useRef, useEffect } from "react";
import { Stage, Layer, Circle } from "react-konva";
import MatrixLineChart from "./chart";
import { get_system, get_w, getPoints } from "./solver.test";
import Konva from "konva";
import { Matrix, round } from "mathjs";




export default function App() {
  const [currentTimeIndex, setCurrentTimeIndex] = useState(0);

  const stageRef = useRef<any>(null);

  const circleRef1 = useRef<any>(null);
  const circleRef2 = useRef<any>(null);


  const [stageSize, setStageSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  // Canvas size
  const width = stageSize.width;
  const height = stageSize.height / 2;

  const points = getPoints();

  const { eigenVectors, eigenValues, coefficients } = get_system();

  useEffect(() => {
    const handleResize = () => setStageSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", handleResize);

    const anim = new Konva.Animation((frame) => {
      let i = frame.time / 1000;

      //setCurrentTimeIndex(i);

      let w: Matrix = get_w(eigenVectors, eigenValues, coefficients, i);

      console.log(w);

      circleRef1.current!.x(600 + w.get([0, 0]) * 100);
      circleRef2.current!.x(400 + w.get([1, 0]) * 100);
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

      <MatrixLineChart matrixData={points} currentTimeIndex={currentTimeIndex} />
    </>
  );
}
