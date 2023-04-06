import * as path from "path";
import {
  readFileSync, unlinkSync, writeFileSync, existsSync, mkdirSync, rmdirSync
} from "fs";
import { Hasher } from "../src/classes/Hasher";

const mocksFolderPath = path.join(__dirname, "mocks");
const mockFilePath = path.join(mocksFolderPath, "mockFile.js");
const dummyMockFilePath = path.join(mocksFolderPath, 'dummyMockFile.js');
const mockFileData = "// This is a mock file to check Hasher class functionality (If you change this, you must also update the mockFileDataHash)";
const mockFileDataHash = "7d131c61a24af69a77ff8656e74eab19491c6f17fb2175c8931d30751b345d2e";
const debugJSON = { [mockFilePath]: mockFileDataHash };

describe("hasher basic functionality", () => {
  let HasherInstance = null;
  const cleanUpHasher = () => {
    if (existsSync(mocksFolderPath)) {
      rmdirSync(mocksFolderPath, { recursive: true, force: true });
    }

    mkdirSync(mocksFolderPath);

    HasherInstance = new Hasher();
    writeFileSync(mockFilePath, mockFileData);
    HasherInstance.updateDebugJSON(debugJSON);
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
    // change the mock file by adding a comment
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
    writeFileSync(dummyMockFilePath, '// Test Mock File');
    HasherInstance.getHash(mocksFolderPath, "", true, true);
    const [changedFiles, newFiles] = HasherInstance.getUpdatedHashes();
    expect(changedFiles).toHaveLength(0);
    expect(newFiles).toHaveLength(1);
  });
});
