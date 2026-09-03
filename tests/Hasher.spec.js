import * as path from "path";
import {
  writeFileSync, existsSync, mkdirSync, rmSync
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
      rmSync(mocksFolderPath, { recursive: true, force: true });
    }

    mkdirSync(mocksFolderPath);

    HasherInstance = new Hasher();
  }

  beforeEach(cleanUpHasher);

  afterAll(() => {
    if (existsSync(mocksFolderPath)) {
      rmSync(mocksFolderPath, { recursive: true, force: true });
    }
  });

  it("should get hash of directory", async () => {
    const hash = await HasherInstance.getHash(mocksFolderPath, "", true, true);
    expect(hash).toBeDefined();
  });

  it("should not have changed or new files", async () => {
    await HasherInstance.getHash(mocksFolderPath, "", true, true);
    const [changedFiles, newFiles] = HasherInstance.getUpdatedHashes();
    expect(changedFiles).toHaveLength(0);
    expect(newFiles).toHaveLength(0);
  });

  it("should have only changed files", async () => {
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
    await HasherInstance.getHash(mocksFolderPath, "", true, true);
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

  it("should have only new files", async () => {
    // create dummy new file
    const dummyMockFilePath = path.join(mocksFolderPath, "dummyMockFile.js");
    writeFileSync(dummyMockFilePath, '// Test Mock File');
    // get updated hash
    await HasherInstance.getHash(mocksFolderPath, "", true, true);
    const [changedFiles, newFiles] = HasherInstance.getUpdatedHashes();
    expect(changedFiles).toHaveLength(0);
    expect(newFiles).toHaveLength(1);
  });


  it("should create and operate on a random file tree with random changes and deletions", async () => {
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
    await HasherInstance.getHash(mocksFolderPath, "", true, true);
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
    await HasherInstance.getHash(mocksFolderPath, "", true, true);
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
    await HasherInstance.getHash(mocksFolderPath, "", true, true);
    const [changedFilesAfterDelete, newFilesAfterDelete] = HasherInstance.getUpdatedHashes();
    expect(changedFilesAfterDelete).toHaveLength(0);
    expect(newFilesAfterDelete).toHaveLength(0);
  });

  it("hashes a tree containing a file above the stream threshold", async () => {
    const bigPath = path.join(mocksFolderPath, "large.bin");
    writeFileSync(bigPath, Buffer.alloc(256 * 1024 + 1, 3));
    const hash = await HasherInstance.getHash(mocksFolderPath, "", false, undefined, undefined, []);
    expect(hash).toMatch(/^m1:[a-f0-9]{64}$/);
  });

  it("produces stable merkle digests across runs", async () => {
    writeFileSync(path.join(mocksFolderPath, "a.js"), "const a = 1;");
    mkdirSync(path.join(mocksFolderPath, "nested"));
    writeFileSync(path.join(mocksFolderPath, "nested", "b.js"), "const b = 2;");
    const first = await HasherInstance.getHash(mocksFolderPath, "build", false, undefined, undefined, []);
    const secondHasher = new Hasher();
    const second = await secondHasher.getHash(mocksFolderPath, "build", false, undefined, undefined, []);
    expect(first).toBe(second);
    expect(first).toMatch(/^m1:[a-f0-9]{64}$/);
  });

  it("reuses merkle leaf hashes when mtime and size match", async () => {
    const filePath = path.join(mocksFolderPath, "reuse.js");
    writeFileSync(filePath, "reuse-me");
    await HasherInstance.getHash(mocksFolderPath, "", false, undefined, undefined, []);
    HasherInstance.resetPerfCounters();
    const warm = await HasherInstance.getHash(mocksFolderPath, "", false, undefined, undefined, []);
    const perf = HasherInstance.getPerfCounters();
    expect(warm).toMatch(/^m1:[a-f0-9]{64}$/);
    expect(perf.filesReused).toBe(1);
    expect(perf.filesHashed).toBe(0);
    expect(perf.bytesRead).toBe(0);
  });

  it("rehashes only changed leaves on content update", async () => {
    const keepPath = path.join(mocksFolderPath, "keep.js");
    const changePath = path.join(mocksFolderPath, "change.js");
    writeFileSync(keepPath, "keep");
    writeFileSync(changePath, "before");
    await HasherInstance.getHash(mocksFolderPath, "", false, undefined, undefined, []);
    writeFileSync(changePath, "after-longer");
    HasherInstance.resetPerfCounters();
    await HasherInstance.getHash(mocksFolderPath, "", false, undefined, undefined, []);
    const perf = HasherInstance.getPerfCounters();
    expect(perf.filesHashed).toBe(1);
    expect(perf.filesReused).toBe(1);
  });
});
