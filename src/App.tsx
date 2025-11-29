import React, { useRef, useEffect } from "react";
import { bernoulli_beam } from "./models";
import { mat2d, vec2 } from "gl-matrix";

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);



  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;


    const system = bernoulli_beam;
    const margin = 0.05;


    // clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);


    const transform = mat2d.create();
    transform

    const scale_x = (1 - 2 * margin) * canvas.width / system.width();
    const scale_y = (1 - 2 * margin) * canvas.height / system.height();

    const offset_x = - system.min_x() + margin * system.width();
    const offset_y = - system.min_y() + margin * system.height();


    mat2d.scale(transform, transform, [scale_x, scale_y]);
    mat2d.translate(transform, transform, [offset_x, offset_y]);

    // draw elements
    ctx.strokeStyle = "#1f6feb";
    ctx.lineWidth = 4;
    bernoulli_beam.elements.forEach(el => {

      let p_a = vec2.fromValues(el.point_a.x, el.point_a.y);
      let p_b = vec2.fromValues(el.point_b.x, el.point_b.y);

      vec2.transformMat2d(p_a, p_a, transform);
      vec2.transformMat2d(p_b, p_b, transform);

      ctx.beginPath();
      ctx.moveTo(p_a[0], p_a[1]);
      ctx.lineTo(p_b[0], p_b[1]);
      ctx.stroke();
    });

    ctx.fillStyle = "#ff0000ff";
    bernoulli_beam.nodes.forEach(n => {

      let p_scaled = vec2.fromValues(n.point.x, n.point.y);

      vec2.transformMat2d(p_scaled, p_scaled, transform);


      ctx.beginPath();
      ctx.arc(p_scaled[0], p_scaled[1], 6, 0, Math.PI * 2);
      ctx.fill();

    });
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h2>Animated Point along a Curve</h2>
      <canvas
        ref={canvasRef}
        width={window.innerWidth}
        height={400}
        style={{ border: "1px solid #ddd", display: "block" }}
      />
      <center>
        <button>
          Hello
        </button>
      </center>

    </div>
  );
};

export default App;
