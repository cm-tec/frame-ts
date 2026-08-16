import type { SystemFile } from '../models/systemFile';

/*
    Every `<name>.json` in this folder becomes a tile on the welcome page, paired with
    `<name>.png` if that exists. Adding an example is a file drop, not a code change:

      1. Build the structure in the editor.
      2. Export  -> <name>.json
      3. Camera  -> <name>.png
      4. Drop both here.

    The tile title comes from the JSON's `name`; add a `description` field by hand for the
    subtitle. Import ignores both, so the file stays loadable.
*/

const files = import.meta.glob<SystemFile>('./*.json', { eager: true, import: 'default' });
const thumbnails = import.meta.glob<string>('./*.png', { eager: true, query: '?url', import: 'default' });

export type Example = {
    key: string;
    name: string;
    description?: string;
    thumbnail?: string;
    data: SystemFile;
};

const stemOf = (path: string) => path.replace(/^\.\//, '').replace(/\.[^.]+$/, '');

export const examples: Example[] = Object.entries(files)
    .map(([path, data]): Example => {
        const key = stemOf(path);
        return {
            key,
            name: data.name?.trim() || key,
            description: data.description?.trim(),
            thumbnail: thumbnails[`./${key}.png`],
            data,
        };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
