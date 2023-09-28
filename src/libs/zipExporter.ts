import fs from 'fs';
import path from 'path';
import UnzippedReader from './UnzippedReader';
import JSZip from '../types/JSZip';

type FSErrorType = {
    code: string;
    message?: string;
}

const extractTo = async (_path = './', jszipObject: JSZip): Promise<void> => {
    let extractionPath = path.normalize(_path);
    const absolutePath = path.resolve(extractionPath);
    if (extractionPath[extractionPath.length - 1] !== path.sep) {
        extractionPath += path.sep;
    }

    const stats = await fs.promises.stat(extractionPath);
    if (!stats.isDirectory()) {
        throw new Error('Path is not a directory');
    }

    const dirs: string[] = [];
    const files: string[] = [];
    const jsZipFiles = Object.values(jszipObject.files);
    jsZipFiles.forEach((file) => {
        const extractedEntryPath = path.resolve(path.join(absolutePath, file.name));
        if (!extractedEntryPath.startsWith(absolutePath)) {
            throw new Error('Entry is outside of the target dir');
        }

        if (file.dir) {
            dirs.push(file.name);
        } else {
            files.push(file.name);
        }
    });

    dirs.sort((a, b) => {
        const calculateDirDepth = (str: string) => (str.match(/\//g) || []).length;
        return calculateDirDepth(a) - calculateDirDepth(b);
    });

    const writeFiles = async () => {
        for (const file of files) {
            const data = await jszipObject.file(file)?.async('nodebuffer');
            if (!data) {
                throw new Error('Could not read file');
            }
            await fs.promises.writeFile(path.join(extractionPath, file), data);
        }
    };

    for (const dir of dirs) {
        try {
            const dirStats = await fs.promises.stat(path.join(extractionPath, dir));
            if (!dirStats.isDirectory()) {
                throw new Error("!dir");
            }
            await writeFiles();
        }
        catch (error) {
            const err = error as FSErrorType;
            if (err.code === 'ENOENT' || err.message === '!dir') {
                await fs.promises.mkdir(path.join(extractionPath, dir), { recursive: true });
            }
            else {
                throw error;
            }
        }
    }
    await writeFiles();
};

class ZipExporter {
    content: JSZip;
    compressed: boolean;
    srcUnzipped: boolean;
    saveAsync: boolean;

    constructor(jszip: JSZip, unzipped = false, async = false) {
        this.content = jszip;
        this.compressed = false;
        this.srcUnzipped = unzipped;
        this.saveAsync = async;
    }

    lowLevel() {
        return this.content;
    }

    compress() {
        if (!this.srcUnzipped) {
            this.compressed = true;
        }
        return this;
    }

    async memory(): Promise<Buffer | UnzippedReader> {
        if (!this.srcUnzipped) {
            const buff = await this.content.generateAsync({ 
                type: 'nodebuffer',
                compression: this.compressed ? 'DEFLATE' : undefined 
            });
            return Buffer.from(buff);
        }
        return new UnzippedReader(this.content);
    }

    async save(_path = './') {
        if (!this.srcUnzipped) {
            const buff = await this.content.generateAsync({
                type: 'nodebuffer',
                compression: this.compressed ? 'DEFLATE' : undefined
            });
            const normalizedPath = path.normalize(_path);
            await fs.promises.writeFile(normalizedPath, buff);
        }
        else {
                await extractTo(_path, this.content);
        }
    }
}

export default ZipExporter;