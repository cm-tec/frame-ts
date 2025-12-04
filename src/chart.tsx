import React, { useMemo } from 'react';
import { Line } from 'react-chartjs-2';

// --- Required Chart.js Imports/Registration ---
// (This block is fine and should be kept)
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
    animator,
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
    'rgb(255, 99, 132)',  // Line 1: Red
    'rgb(54, 162, 235)',  // Line 2: Blue
    'rgb(75, 192, 192)',  // Line 3: Teal
    'rgb(255, 205, 86)',  // Line 4: Yellow
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
const MatrixLineChart = ({ matrixData, currentTime }: { matrixData: Matrix, currentTime: number }) => {
    // Use useMemo to prevent recalculation unless data or index changes
    const chartData = useMemo(() => {
        return prepareChartData(matrixData);
    }, [matrixData]);





    // Define chart options
    const options = {
        responsive: true,
        scales: {
            x: {
                type: 'linear' as const,  // must be linear to interpolate
                title: { display: true, text: 'Time' },
                min: matrixData.get([0, 0]),
                max: matrixData.get([0, matrixData.size()[1] - 1])
            },
            y: {
                title: {
                    display: true,
                    text: 'Value',
                },
            }
        },
        plugins: {
            legend: {
                position: 'top' as const,
            },
            title: {
                display: true,
                text: `Animated Plot - Current time: ${currentTime.toFixed(2)}s`,
            },

            verticalLinePlugin: {
                xValue: currentTime,  // <-- updates the vertical line
                color: "gray"
            }
        },
        elements: {
            point: {
                radius: 0
            }
        },
        animation: {
            duration: 0, // initial render has no animation
            // You can also customize updates:
            onComplete: () => { /* optional callback */ }
        },
    };

    return (

        <Line options={options} data={chartData} />

    );
};

export default MatrixLineChart;