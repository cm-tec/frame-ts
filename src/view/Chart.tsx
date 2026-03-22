import React, { useMemo, useEffect, useRef } from 'react';
import { Line } from 'react-chartjs-2';
import { useAnimationStore } from '../store/animationStore';

// --- Required Chart.js Imports/Registration ---
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Chart,
} from 'chart.js';
import { row, type Matrix } from 'mathjs';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);

const verticalLinePlugin = {
    id: 'verticalLinePlugin',
    afterDraw: (chart: { scales?: any; ctx?: any; chartArea?: any; }, args: any, options: { xValue: any; color: string; }) => {
        const { ctx, chartArea: { top, bottom } } = chart;
        const x = chart.scales.x.getPixelForValue(options.xValue);

        ctx.save();
        ctx.strokeStyle = options.color || 'red';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, top);
        ctx.lineTo(x, bottom);
        ctx.stroke();
        ctx.restore();
    }
};

Chart.register(verticalLinePlugin);

// --- Style Constants ---
const colors = [
    'rgb(255, 99, 132)',
    'rgb(54, 162, 235)',
    'rgb(75, 192, 192)',
    'rgb(255, 205, 86)',
];

const prepareChartData = (matrix: Matrix) => {
    const t = row(matrix, 0);
    const tArray = (t.toArray().flat() as number[]).map(x => +x.toFixed(2));
    const datasets = (matrix.toArray() as number[][])
        .slice(1)
        .map((rowData, i) => ({
            label: `Line ${i + 1}`,
            data: tArray.map((x, j) => ({ x, y: rowData[j] })),
            borderColor: colors[i % colors.length],
            backgroundColor: colors[i % colors.length],
            fill: false,
            tension: 0.2,
            pointRadius: 0
        }));
    return { datasets };
};

// --- React Component ---
const MatrixLineChart = ({ matrixData, yAxis }: { matrixData: Matrix, yAxis: string }) => {
    const chartRef = useRef<Chart<'line'>>(null);

    useEffect(() => {
        return useAnimationStore.subscribe(state => {
            const chart = chartRef.current;
            if (!chart) return;
            const t = state.time;
            (chart.options.plugins as any).title.text = `Current time: ${t.toFixed(2)}s`;
            (chart.options.plugins as any).verticalLinePlugin.xValue = t;
            chart.update('none');
        });
    }, []);

    const chartData = useMemo(() => prepareChartData(matrixData), [matrixData]);

    const options = useMemo(() => ({
        responsive: true,
        scales: {
            x: {
                type: 'linear' as const,
                title: { display: true, text: 'Time' },
                min: matrixData.get([0, 0]),
                max: matrixData.get([0, matrixData.size()[1] - 1])
            },
            y: {
                title: { display: true, text: yAxis },
            }
        },
        plugins: {
            legend: { display: false, position: 'top' as const },
            title: { display: true, text: `Current time: 0.00s` },
            verticalLinePlugin: { xValue: 0, color: "gray" }
        },
        elements: { point: { radius: 0 }, line: { borderWidth: 1 } },
        animation: { duration: 0 },
    }), [matrixData, yAxis]);

    return <Line ref={chartRef} options={options} data={chartData} />;
};

export default MatrixLineChart;
