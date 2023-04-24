import * as path from "path";
import {
  writeFileSync, existsSync, mkdirSync, rmdirSync, rmSync
} from "fs";
import { Hasher } from "../src/classes/Hasher";
import { 
  generateFileTree, hashData, walkFileTree, randomPick, updateFileContents 
} from "./utils";


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
    HasherInstance.updateDebugJSON(
      {[mockFilePath]: hashData(mockFileData)}
    )

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


  it("should create and operate on a random file tree with random changes and deletions", () => {
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
