import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';
import path from 'path';

export const genStr = (_size) => {
    const size = Math.floor(Math.random() * _size) + 3;
    const randomString = Math.random().toString(36).substring(2, size);
    return randomString;
}

export const generateFile = (prefix, index) => {
    const fileName = `${genStr(100)}_${index}.js`;
    const filePath = path.join(prefix, fileName);
    const fileData = genStr(1000);

    writeFileSync(filePath, fileData);

    return filePath;
}

export const updateFileContents = (filePath) => {
    const newData = genStr(1000);
    const oldData = readFileSync(filePath, { encoding: 'utf8' });
    writeFileSync(filePath, oldData + newData);
}


export const generateDirectory = (prefix) => {
    const dirName = genStr(100);
    const dirPath = path.join(prefix, dirName);

    if (!existsSync(dirPath)) {
        mkdirSync(dirPath, { recursive: true, });
    }
    return dirPath;
}


export const generateFileTree = (prefix, depth, fanout) => {
    if (depth === 0) {
        return 0;
    }

    let numberOfFiles = 0;

    for (let i = 0; i < fanout; i++) {
        const isFile = Math.random() > 0.5;

        if (isFile) {
            generateFile(prefix, i);
            numberOfFiles++;
        } else {
            const dir = generateDirectory(prefix);
            numberOfFiles += generateFileTree(dir, depth - 1, fanout);
        }
    }

    return numberOfFiles;
}

export const hashData = (data) => {
    return createHash('sha256').update(data).digest('hex');
}


export const walkFileTree = (dir) => {
    let results = [];
    const list = readdirSync(dir);
    list.forEach(
        (elem) => {
            if (elem.endsWith('.js')) {
                results.push(path.join(dir, elem));
            } else {
                results = results.concat(walkFileTree(path.join(dir, elem)));
            }
        }
    );
    return results;
}

export const randomPick = (arr, n) => {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, n);
}
