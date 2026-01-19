import React, { useRef, useEffect, useMemo } from 'react';
import { Stage, Layer, Circle, Line } from 'react-konva';
import Konva from 'konva';

// 1. Define the shape of our data
interface NodeData {
    id: string;
    x: number;
    y: number;
    color: string;
}

const MinimalNetwork = () => {
    const layerRef = useRef<Konva.Layer>(null);
    const nodesRef = useRef<Map<string, Konva.Circle>>(new Map());
    const lineRef = useRef<Konva.Line>(null);

    const items: NodeData[] = useMemo(() => [
        { id: 'n1', x: 150, y: 150, color: '#00d2ff' },
        { id: 'n2', x: 350, y: 150, color: '#ff0000' },
        { id: 'n3', x: 250, y: 350, color: '#00ff00' },
    ], []);

    useEffect(() => {
        // Ensure the layer exists before starting animation
        if (!layerRef.current) return;

        const anim = new Konva.Animation((frame) => {
            if (!frame) return;
            const time = frame.time / 1000;

            // Update Node Positions
            items.forEach((item, i) => {
                const node = nodesRef.current.get(item.id);
                if (node) {
                    // Add a simple "float" effect
                    node.x(item.x + Math.sin(time + i) * 30);
                    node.y(item.y + Math.cos(time + i) * 30);
                }
            });

            // Update the Curve (Line) points based on new node positions
            if (lineRef.current) {
                const newPoints: number[] = [];
                items.forEach((item) => {
                    const node = nodesRef.current.get(item.id);
                    if (node) {
                        newPoints.push(node.x(), node.y());
                    }
                });
                // Loop the line back to the start for a closed loop
                const firstNode = nodesRef.current.get(items[0].id);
                if (firstNode) {
                    newPoints.push(firstNode.x(), firstNode.y());
                }

                lineRef.current.points(newPoints);
            }
        }, layerRef.current);

        anim.start();

        // The "Destructor" must be a function that calls stop()
        return () => {
            anim.stop();
        };
    }, [items]);

    return (
        <Stage width={window.innerWidth} height={window.innerHeight}>
            <Layer ref={layerRef}>
                {/* The Curve */}
                <Line
                    ref={lineRef}
                    stroke="#333"
                    strokeWidth={4}
                    tension={0.4} // Smooths the path between points
                    lineCap="round"
                    lineJoin="round"
                    listening={false} // Performance boost: ignore mouse events
                />

                {/* The Nodes */}
                {items.map((node) => (
                    <Circle
                        key={node.id}
                        // Callback ref to populate our Map
                        ref={(el) => {
                            if (el) nodesRef.current.set(node.id, el);
                        }}
                        x={node.x}
                        y={node.y}
                        radius={20}
                        fill={node.color}
                        shadowColor="black"
                        shadowBlur={10}
                        shadowOpacity={0.3}
                    />
                ))}
            </Layer>
        </Stage>
    );
};

export default MinimalNetwork;