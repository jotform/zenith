/* eslint-disable */
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import ZipExporter from '../libs/zipExporter';
import UnzippedReader from '../libs/UnzippedReader';

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
        fs.readdir(dir, async (err, files) => {
            if (err) {
                reject(err);
            }
            const filePaths = files.map(file => path.normalize(path.join(dir, file)));
            const typedFiles = Array(filePaths.length);

            for (const filePath of filePaths) {
                fs.stat(filePath, async (err, stats) => {
                    if (err) {
                        reject(err);
                    }
                    typedFiles[filePaths.indexOf(filePath)] = {
                        path: filePath,
                        isDirectory: stats.isDirectory() ? 'dir' : 'file',
                    };
                });
            }
            for (const entry of typedFiles) {
                const parsedEntryPath = path.parse(entry.path);
                if (entry.type === 'dir') {
                    const newZippedDir = zippedDir.folder(parsedEntryPath.base);
                    await zipDir(entry.path, newZippedDir);
                }
                else {
                    fs.readFile(entry.path, async (err, data) => {
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
}

const Zipper = {};
Zipper.sync = {};

Zipper.zip = async (entity, _callback, _shiftedCallback) => {
    const zippedObj = JSZip.make();
    if (typeof entity === 'string') {
        // entity is a path to a file/directory
        const callback = _callback || (() => {});
        const normalizedPath = path.normalize(entity);
        fs.stat(normalizedPath, async (err, stats) => {
            if (err) {
                callback(err);
            }
            if (stats.isDirectory()) {
                await zipDir(normalizedPath, zippedObj);
                callback(null, new ZipExporter(zippedObj, false, true));
            }
            else {
                const parsedPath = path.parse(normalizedPath);
                fs.readFile(normalizedPath, async (err, data) => {
                    if (err) {
                        callback(err);
                    }
                    zippedObj.file(parsedPath.base, data);
                    callback(null, new ZipExporter(zippedObj, false, true));
                });
            }
            callback(null, zippedObj);
        });
    }
    else if (entity instanceof Buffer) {
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

export default Zipper;