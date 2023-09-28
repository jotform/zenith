/* eslint-disable */
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import ZipExporter from '../libs/zipExporter';
import UnzippedReader from '../libs/UnzippedReader';
import { Readable } from 'stream';

JSZip.make = () => {
    const augment = (_opts) => {
        const opts = _opts || {};
        opts.createFolders = opts.createFolders || true;
        return opts;
    }

    const instance = new JSZip();
    const originals = {
        loadAsync: instance.loadAsync,
        file: instance.file,
    };

    instance.loadAsync = (data, options) => {
        return originals.loadAsync.call(instance, data, augment(options));
    };

    instance.file = (name, content, options) => {
        if (!content) {
            return originals.file.call(instance, name);
        }
        return originals.file.call(instance, name, content, augment(options));
    };
    return instance;
};

const zipDir = async (dir, zippedDir) => {
    return new Promise((resolve, reject) => {
        fs.readdir(dir, (err, files) => {
            if (err) {
                reject(err);
            }
            const filePaths = files.map(file => path.join(dir, file));
            const typedFiles = filePaths.reduce((acc, filePath) => {
                const stats = fs.statSync(filePath);
                acc.push({
                    path: filePath,
                    isDirectory: stats.isDirectory() ? 'dir' : 'file',
                });
                return acc;
            }, []);
            for (const entry of typedFiles) {
                const parsedEntryPath = path.parse(entry.path);
                if (entry.type === 'dir') {
                    const newZippedDir = zippedDir.folder(parsedEntryPath.base);
                    zipDir(entry.path, newZippedDir).then(console.log);
                }
                else {
                    fs.readFile(entry.path, (err, data) => {
                        if (err) {
                            reject(err);
                        }
                        zippedDir.file(parsedEntryPath.base, data);
                    });
                }
            }
            resolve();
        });
    });
}

const zipDirSync = (dir, zippedDir) => {
    const entries = fs.readdirSync(dir);

    for (const entry of entries) {
        const entryNormalizedPath = path.normalize(path.join(dir, entry));
        const stats = fs.statSync(entryNormalizedPath);
        if (stats.isDirectory()) {
            const newZippedDir = zippedDir.folder(entry);
            zipDirSync(entryNormalizedPath, newZippedDir);
        }
        else {
            const data = fs.readFileSync(entryNormalizedPath);
            zippedDir.file(entry, data);
        }
    }
    return zippedDir;
}

const Zipper = {};

Zipper.zip = (entity, _callback, _shiftedCallback) => {
    const zippedObj = JSZip.make();
    if (entity instanceof Buffer) {
        // entity is a buffer containing a file, _callback is the name of the buffer
        const callback = _shiftedCallback || (() => {});
        zippedObj.file(_callback, entity);
        callback(null, new ZipExporter(zippedObj, false, true));
    }
    else if (entity instanceof UnzippedReader) {
        // entity is an unzipped file
        const callback = _callback || (() => {});
        callback(null, new ZipExporter(entity.unzipped_file, false, true));
    }
    else {
        _callback(new Error('Invalid entity type'));
    }
};

Zipper.unzip = async (entity) => {
    const zippedObj = JSZip.make();
    await zippedObj.loadAsync(entity);
    return new ZipExporter(zippedObj, true, true);
}

export default Zipper;