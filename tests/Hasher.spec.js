import * as path from "path";
import {
  readFileSync, unlinkSync, writeFileSync, existsSync, mkdirSync, rmdirSync, write, readdirSync, rmSync
} from "fs";
import { Hasher } from "../src/classes/Hasher";
import { createHash } from 'crypto';

const genStr = (_size) => {
  const size = Math.floor(Math.random() * _size) + 3;
  const randomString = Math.random().toString(36).substring(2, size);
  return randomString;
}

const generateFile = (prefix, index) => {
  const fileName = `${genStr(100)}_${index}.js`;
  const filePath = path.join(prefix, fileName);
  const fileData = genStr(1000);

  writeFileSync(filePath, fileData);

  return filePath;
}

const updateFileContents = (filePath) => {
  const newData = genStr(1000);
  const oldData = readFileSync(filePath, { encoding: 'utf8' });
  writeFileSync(filePath, oldData + newData);
}


const generateDirectory = (prefix) => {
  const dirName = genStr(100);
  const dirPath = path.join(prefix, dirName);

  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true,  });
  }
  return dirPath;
}


const generateFileTree = (prefix, depth, fanout) => {
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

const hash = (data) => {
  return createHash('sha256').update(data).digest('hex');
}


const walkFileTree = (dir) => {
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

const randomPick = (arr, n) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, n);
}


const mocksFolderPath = path.join(__dirname, "mocks");

describe("hasher basic functionality", () => {
  let HasherInstance = null;
  const cleanUpHasher = () => {
    if (existsSync(mocksFolderPath)) {
      rmdirSync(mocksFolderPath, { recursive: true, force: true });
    }

    mkdirSync(mocksFolderPath);

    HasherInstance = new Hasher();
  }

  beforeEach(cleanUpHasher);

  afterAll(() => {
    if (existsSync(mocksFolderPath)) {
      rmdirSync(mocksFolderPath, { recursive: true, force: true });
    }
  });

  it("should get hash of directory", () => {
    const hash = HasherInstance.getHash(mocksFolderPath, "", true, true);
    expect(hash).toBeDefined();
  });

  it("should not have changed or new files", () => {
    const hash = HasherInstance.getHash(mocksFolderPath, "", true, true);
    const [changedFiles, newFiles] = HasherInstance.getUpdatedHashes();
    expect(changedFiles).toHaveLength(0);
    expect(newFiles).toHaveLength(0);
  });

  it("should have only changed files", () => {
    // create original
    const mockFilePath = path.join(mocksFolderPath, "mockFile.js");
    const mockFileData = "// Test Mock File";
    writeFileSync(mockFilePath, mockFileData);
    // get hash, and empty updated hashes
    HasherInstance.getHash(mocksFolderPath, "", true, true);
    HasherInstance.emptyUpdatedHashes();

    // update mock file
    const newMockFile = mockFileData + "\n // test comment";
    writeFileSync(mockFilePath, newMockFile);
    // get updated hash of mock file
    const hash = HasherInstance.getHash(mocksFolderPath, "", true, true);
    const [changedFiles, newFiles] = HasherInstance.getUpdatedHashes();
    expect(changedFiles).toHaveLength(1);
    expect(newFiles).toHaveLength(0);
  });

  it("should empty uptaded hashes", () => {
    HasherInstance.emptyUpdatedHashes();
    const [changedFilesAfterEmpty, newFilesAfterEmpty] = HasherInstance.getUpdatedHashes();
    expect(changedFilesAfterEmpty).toHaveLength(0);
    expect(newFilesAfterEmpty).toHaveLength(0);
  });

  it("should have only new files", () => {
    // create dummy new file
    const dummyMockFilePath = path.join(mocksFolderPath, "dummyMockFile.js");
    writeFileSync(dummyMockFilePath, '// Test Mock File');
    // get updated hash
    HasherInstance.getHash(mocksFolderPath, "", true, true);
    const [changedFiles, newFiles] = HasherInstance.getUpdatedHashes();
    expect(changedFiles).toHaveLength(0);
    expect(newFiles).toHaveLength(1);
  });


  it("Should be fun", () => {
    // Depth is the level of nesting inside the file tree
    const depth = 5;
    // Fanout is the number of elements at each level
    const fanout = 5;

    // Generate a random file tree
    const numberOfFiles = generateFileTree(mocksFolderPath, depth, fanout);
    // Generate a random number of files to change
    const numberOfFilesToChange = Math.floor(Math.random() * numberOfFiles) + 1;
    // Generate a random number of files to delete
    const numberOfFilesToDelete = Math.floor(Math.random() * numberOfFiles) + 1;

    // Get all files in the file tree
    const allFiles = walkFileTree(mocksFolderPath);
    expect(allFiles).toHaveLength(numberOfFiles);

    // Get the hash of the file tree
    HasherInstance.getHash(mocksFolderPath, "", true, true);
    const [changedFiles, newFiles] = HasherInstance.getUpdatedHashes();
    expect(changedFiles).toHaveLength(0);
    expect(newFiles).toHaveLength(numberOfFiles);

    // Pick random files to change
    const filesToChange = randomPick(allFiles, numberOfFilesToChange);
    expect(filesToChange).toHaveLength(numberOfFilesToChange);

    // Change the contents of the files
    filesToChange.forEach((filePath) => {
      updateFileContents(filePath);
    });

    // Get the updated hash of the file tree
    HasherInstance.emptyUpdatedHashes();
    HasherInstance.getHash(mocksFolderPath, "", true, true);
    const [changedFilesAfterChange, newFilesAfterChange] = HasherInstance.getUpdatedHashes();
    expect(changedFilesAfterChange).toHaveLength(numberOfFilesToChange);
    expect(newFilesAfterChange).toHaveLength(0);

    // Pick random files to delete
    const filesToDelete = randomPick(allFiles, numberOfFilesToDelete);
    expect(filesToDelete).toHaveLength(numberOfFilesToDelete);

    // Delete the files
    filesToDelete.forEach((filePath) => {
      rmSync(filePath);
    });

    // Get the updated hash of the file tree
    HasherInstance.emptyUpdatedHashes();
    HasherInstance.getHash(mocksFolderPath, "", true, true);
    const [changedFilesAfterDelete, newFilesAfterDelete] = HasherInstance.getUpdatedHashes();
    expect(changedFilesAfterDelete).toHaveLength(0);
    expect(newFilesAfterDelete).toHaveLength(0);
  });
});
