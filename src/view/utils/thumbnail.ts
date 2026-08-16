import type Konva from 'konva';

// Konva selector name on the viewer's grid layer, so a capture can hide the grid
// imperatively instead of forcing a re-render of the whole stage.
export const GRID_LAYER_NAME = 'grid-layer';

// Tiles on the welcome page share one aspect ratio, otherwise every snapshot would
// inherit whatever shape the browser window happened to have.
const ASPECT = 16 / 10;
const PIXEL_RATIO = 2;

export function toFilenameStem(name: string, fallback = 'structure'): string {
    const stem = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return stem || fallback;
}

/**
 * Downloads a PNG of the current viewer contents, grid and axis labels omitted.
 *
 * The image is cropped to the tile aspect ratio around the centre of the stage. The
 * viewer centres and fits the structure, so the trimmed strip is always empty margin.
 */
export function downloadThumbnail(stage: Konva.Stage, filename: string): void {
    const width = stage.width();
    const height = stage.height();
    if (width === 0 || height === 0) return;

    const tooWide = width / height > ASPECT;
    const cropWidth = tooWide ? height * ASPECT : width;
    const cropHeight = tooWide ? height : width / ASPECT;

    const grid = stage.findOne(`.${GRID_LAYER_NAME}`);

    let url: string;
    try {
        grid?.hide();
        // toDataURL renders synchronously, so the hidden grid never reaches a painted frame.
        url = stage.toDataURL({
            x: (width - cropWidth) / 2,
            y: (height - cropHeight) / 2,
            width: cropWidth,
            height: cropHeight,
            pixelRatio: PIXEL_RATIO,
            mimeType: 'image/png',
        });
    } finally {
        grid?.show();
    }

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
}
