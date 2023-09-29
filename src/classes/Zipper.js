/* eslint-disable */
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import ZipExporter from '../libs/zipExporter';

JSZip.make = () => {
  const augment = (_opts) => {
    const opts = _opts || {};
    opts.createFolders = opts.createFolders || true;
    return opts;
  };

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
  const files = await fs.promises.readdir(dir);
  const filePaths = files.map(file => path.join(dir, file));
  const typedFiles = [];
  for (const filePath of filePaths) {
    const stats = await fs.promises.stat(filePath);
    typedFiles.push({
      path: filePath,
      type: stats.isDirectory() ? 'dir' : 'file',
    });
  }
  for (const entry of typedFiles) {
    const parsedEntryPath = path.parse(entry.path);
    if (entry.type === 'dir') {
      zippedDir.folder(parsedEntryPath.base);
      await zipDir(entry.path, zippedDir);
    }
    else {
      const data = await fs.promises.readFile(entry.path);
      zippedDir.file(parsedEntryPath.base, data.toString());
    }
  }
};

const Zipper = {};

Zipper.zip = async (entity, _callback, _shiftedCallback) => {
  const zippedObj = JSZip.make();
  if (typeof entity === 'string') {
    // entity is a path to a file/directory
    const callback = _callback || (() => {});
    const normalizedPath = path.normalize(entity);
    const stats = await fs.promises.stat(normalizedPath);
    if (stats.isDirectory()) {
      await zipDir(normalizedPath, zippedObj);
      callback(null, new ZipExporter(zippedObj, false, true));
      return;
    }
    else {
      const parsedPath = path.parse(normalizedPath);
      const data = await fs.promises.readFile(normalizedPath);
      zippedObj.file(parsedPath.base, data);
      callback(null, new ZipExporter(zippedObj, false, true));
    }
  }
  else {
    _callback(new Error('Invalid entity type'));
  }
};

Zipper.unzip = async (entity) => {
  const zippedObj = JSZip.make();
  await zippedObj.loadAsync(entity);
  return new ZipExporter(zippedObj, true, true);
};

export default Zipper;
