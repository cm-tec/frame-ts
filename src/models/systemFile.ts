import type { NodeInput, ElementInput, HingeInput, InitialConditions, Loads } from './inputModels';


export const SYSTEM_FILE_VERSION = 1;


export type SystemFile = {
    version: number;
    name?: string;
    description?: string;
    view?: 'dynamic' | 'static';
    nodes?: NodeInput[];
    elements?: ElementInput[];
    hinges?: HingeInput[];
    initialConditions?: InitialConditions;
    loads?: Loads;
};

export type MigrationResult =
    | { ok: true; file: SystemFile }
    | { ok: false; reason: string };


export function migrateSystemFile(raw: SystemFile): MigrationResult {
    const version = raw.version;

    if (!Number.isInteger(version) || version < 1) {
        return { ok: false, reason: `Missing or unreadable file version ${JSON.stringify(version)}.` };
    }

    if (version > SYSTEM_FILE_VERSION) {
        return {
            ok: false,
            reason: `This file was written by a newer version of FrameTS `
                + `(file version ${version}, this build reads up to ${SYSTEM_FILE_VERSION}).`,
        };
    }

    let file = raw;

    for (let v = version; v < SYSTEM_FILE_VERSION; v++) {
        const step = MIGRATIONS[v];
        if (!step) return { ok: false, reason: `No migration from file version ${v} to ${SYSTEM_FILE_VERSION}.` };
        file = step(file);
    }

    return { ok: true, file: { ...file, version: SYSTEM_FILE_VERSION } };
}

const MIGRATIONS: Record<number, (file: SystemFile) => SystemFile> = {};
