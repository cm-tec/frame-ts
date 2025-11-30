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
} from 'chart.js';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);

// --- Style Constants ---
const colors = [
    'rgb(255, 99, 132)',  // Line 1: Red
    'rgb(54, 162, 235)',  // Line 2: Blue
    'rgb(75, 192, 192)',  // Line 3: Teal
    'rgb(255, 205, 86)',  // Line 4: Yellow
];
const HIGHLIGHT_COLOR = 'rgb(255, 0, 255)'; // Magenta highlight
const HIGHLIGHT_RADIUS = 5;
const DEFAULT_RADIUS = 0;

// --- Data Preparation Function (Fixed for Standard JS Arrays) ---

/**
 * Transforms a standard 2D array into the Chart.js data format and applies point highlighting.
 * @param {number[][]} matrix The 4-row 2D array.
 * @param {number} currentTimeIndex The index of the point to highlight.
 * @returns {object} The Chart.js data object.
 */
const prepareChartData = (matrix: number[][], currentTimeIndex: number) => {

    const numRows = matrix.length;
    const numCols = matrix[0] ? matrix[0].length : 0;

    // 1. Determine X-axis labels (0 to N-1)
    const labels = Array.from({ length: numCols }, (_, i) => i);

    // 2. Extract and format the datasets
    const datasets = matrix.map((rowData, i) => {
        // --- Highlighting Logic ---

        // Array to determine the radius of EVERY point
        const pointRadius = rowData.map((_, index) =>
            index === currentTimeIndex ? HIGHLIGHT_RADIUS : DEFAULT_RADIUS
        );

        // Array to determine the background color of EVERY point
        const pointBackgroundColor = rowData.map((_, index) =>
            index === currentTimeIndex ? HIGHLIGHT_COLOR : colors[i % colors.length]
        );
        // -------------------------

        return {
            label: `Line ${i + 1} (Row ${i})`,
            data: rowData,
            borderColor: colors[i % colors.length],
            backgroundColor: colors[i % colors.length],
            fill: false,
            tension: 0.2,

            // Apply the dynamic style arrays
            pointRadius: pointRadius,
            pointBackgroundColor: pointBackgroundColor,
        };
    }).slice(0, 2);

    return { labels, datasets };
};

// --- React Component ---
const MatrixLineChart = ({ matrixData, currentTimeIndex }: { matrixData: number[][], currentTimeIndex: number }) => {

    // Check if the matrix has 4 rows before proceeding
    if (matrixData.length !== 4) {
        return <div>Error: Matrix must have exactly 4 rows.</div>;
    }

    // Use useMemo to prevent recalculation unless data or index changes
    const chartData = useMemo(() => {
        return prepareChartData(matrixData, currentTimeIndex);
    }, [matrixData, currentTimeIndex]);

    // Define chart options
    const options = {
        responsive: true,
        scales: {
            x: {
                title: {
                    display: true,
                    text: 'Time Step',
                },
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
                text: `Animated Plot - Current Step: ${currentTimeIndex}`,
            }
        },
        // Remove the static global point radius setting, as we use dynamic arrays now
        // elements: {
        //     point: {
        //         radius: 0,
        //     }
        // }
    };

    return (
        <div style={{ width: '800px', margin: '20px auto' }}>
            <Line options={options} data={chartData} />
        </div>
    );
};

export default MatrixLineChart;