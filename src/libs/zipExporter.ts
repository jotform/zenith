import fs from 'fs';
import path from 'path';
import UnzippedReader from './UnzippedReader';
import JSZip from '../types/JSZip';

type CallbackType = (err: Error | null, data?: Buffer) => void;
type FSErrorType = {
    code: string;
    message?: string;
}

const extractTo = (_path = './', jszipObject: JSZip, callback: CallbackType) => {
    let extractionPath = path.normalize(_path);
    const absolutePath = path.resolve(extractionPath);
    if (extractionPath[extractionPath.length - 1] !== path.sep) {
        extractionPath += path.sep;
    }

    fs.stat(extractionPath, (err, stats) => {
        if (err) {
            callback(err);
            return;
        }
        if (!stats.isDirectory()) {
            callback(new Error('Path is not a directory'));
            return;
        }

        const dirs: string[] = [];
        const files: string[] = [];
        const jsZipFiles = Object.values(jszipObject.files);
        jsZipFiles.forEach((file) => {
            const extractedEntryPath = path.resolve(path.join(absolutePath, file.name));
            if (!extractedEntryPath.startsWith(absolutePath)) {
                callback(new Error('Entry is outside of the target dir'));
                return;
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

        const writeFiles = (err: Error | null = null) => {
            if (err) {
                callback(err);
                return;
            }
            for (const file of files) {
                void jszipObject.file(file)?.async('nodebuffer').then((data: Buffer) => {
                    fs.writeFile(path.join(extractionPath, file), data, (err) => {
                        if (err) {
                            callback(err);
                            return;
                        }
                        callback(null);
                        return;
                    });
                });
            }
        };

        dirs.forEach((dir) => {
            fs.stat(path.join(extractionPath, dir), (err, dirStats) => {
                if ((err && err.code === 'ENOENT') || !dirStats.isDirectory()) {
                    fs.mkdir(path.join(extractionPath, dir), (err => {
                        if (err) {
                            writeFiles(err);
                            return;
                        }
                        writeFiles();
                    }));
                }
            });
        });
    });
};

const extractToSync = (_path = './', jszipObject: JSZip) => {
    let extractionPath = path.normalize(_path);
    const absolutePath = path.resolve(extractionPath);
    if (extractionPath[extractionPath.length - 1] !== path.sep) {
        extractionPath += path.sep;
    }

    const stats = fs.statSync(extractionPath);

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

    
    dirs.forEach((dir) => {
        try {
            const dirStats = fs.statSync(path.join(extractionPath, dir));
            if (!dirStats.isDirectory()) {
                throw new Error("!dir");
            }
        }
        catch (err) {
            const error = err as FSErrorType;
            if (error.code === 'ENOENT' || error.message === '!dir') {
                fs.mkdirSync(path.join(extractionPath, dir));
            }
            else {
                throw err;
            }
        }
    });
    
    for (const file of files) {
        void jszipObject.file(file)?.async('nodebuffer').then((data: Buffer) => {
            if (data) {
                fs.writeFileSync(path.join(extractionPath, file), data);
            }
        });
    }
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

    async save(_path = './', callback: CallbackType) {
        if (!this.srcUnzipped) {
            const buff = await this.content.generateAsync({
                type: 'nodebuffer',
                compression: this.compressed ? 'DEFLATE' : undefined
            });
            const normalizedPath = path.normalize(_path);
            if (!this.saveAsync) {
                fs.writeFileSync(normalizedPath, buff);
            }
            else {
                fs.writeFile(normalizedPath, buff, callback);
            }
        }
        else {
            if (!this.saveAsync) {
                extractToSync(_path, this.content);
            }
            else {
                extractTo(_path, this.content, callback);
            }
        }
    }
}

export default ZipExporter;