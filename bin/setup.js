#!/usr/bin/node

const { removeTypeDuplicates } = require("@babel/types");
const { dir, error } = require("console");
const fs = require("fs");
const path = require("path");
const { Readline } = require("readline/promises");

let userInput = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
});

let filePaths = [];
let fileNames = [];
let ignoredDirectories = [];
let ignoredApps = [];
let packages = [];

let tempDirectories = [];
let tempApps = [];
let packageCount = 0;

ignoredDirectories.push("node_modules");
ignoredDirectories.push(".git");

const appDirectory = () => {
  return new Promise((resolve) => {
    console.log("Enter app directories (x to stop)");
    const dirInput = (dirChoice) => {
      if (dirChoice.toLowerCase() === 'x') {
        console.log("Directory entry stopped.");
        ignoredApps.push(...tempApps);
        ignoredApps = removeDuplicate(ignoredApps);
        console.log("\nYour app directories\n------------------\n", ignoredApps);
        searchAppDirJSON(ignoredApps);
        resolve("Taking app directory is done.");
        userInput.removeListener('line',dirInput);
      } else {
        console.log("New app directory added.");
        tempApps.push(dirChoice);
        console.log("\nCurrent App Directories\n-----------------------------\n", tempApps);
      }
    };
    userInput.on('line', dirInput);
  });
};

function searchAppDirJSON(appDir)
{
  const file = './packageInfo.json';
  let existingDataApp = {};
  if (fs.existsSync(file)) {
    const fileContent = fs.readFileSync(file, 'utf8');
    if (fileContent) {
      existingDataApp = JSON.parse(fileContent);
    }
  }
  existingDataApp.appDirectories = appDir;
  ignoredApps = appDir;
}

function chooseDirectory() {
  return new Promise (async (resolve) => {
    console.log("Do you want to ignore .gitignore (x = no, y = yes)");
    const gitInput = async (gitChoice) => {
      userInput.removeListener('line',gitInput);
      gitChoice.toLowerCase();
      console.log("Choice-->", gitChoice);
      if (gitChoice === "x") {
        console.log("You have selected to \"not\" ignore the .github");
        resolve();
      } else if (gitChoice === "y" || gitChoice === "yes") {
        await readGitignore();
        console.log("You have selected to ignore .github");
        resolve();
      } else {
        console.log("Wrong input detected, new one required.");
        userInput.on('line',gitInput);
      }
    };
    userInput.on('line',gitInput);
  });
}

function readGitignore () {
  return new Promise (resolve => {
    try {
      const gitPackages = path.resolve('.gitignore');
      fs.readFile(gitPackages, 'utf8', (err,data) => {
      const newData = data 
        .split('\n')
        .map(data => data.trim())
        .filter(data => data && !data.startsWith('#'));

      ignoredDirectories.push(...newData);
      console.log("gitignore files have been added.",ignoredDirectories);
      resolve();
      });
    } catch (error) {
      console.log("Error occured when reading github",error)
      
      if (data == null)
        console.log(".gitignore data is null ")
    };
  })
};

function optionalDir() {
  return new Promise (resolve => {
    userInput.question("Is there any directories you want to ignore ? (Write \"y\" to add new directories, else will quit adding new directories.)\nChoice:", userChoice => {
      console.log("Press \"n\" to quit")
      if (userChoice.toLowerCase() === "y") {
        const optInput = (optChoice) => {
          if (optChoice.length == 1 && optChoice.toLowerCase().includes('n')) {
            userInput.removeListener('line',optInput);
            console.log("-Current ignored directories-\n", ignoredDirectories, "\n----------------------------\n"
                       ,"-Newly added directories-\n", tempDirectories);
            ignoredDirectories.push(...tempDirectories);
            ignoredDirectories = removeDuplicate(ignoredDirectories);
            console.log("Optional directories is done. Ignored directories\n---------------------------------\n", ignoredDirectories);
            searchDirectory('.',ignoredDirectories,ignoredApps);
            resolve();
          } else {
            tempDirectories.push(optChoice);
            console.log("Current ignored directories:", tempDirectories)
          }
        }//optInput
        userInput.on('line',optInput);
      } else {
        console.log("You have selected to quit adding more directories. Current directories to be ignored:", ignoredDirectories);
        searchDirectory('.',ignoredDirectories,ignoredApps);
      }
    });//userQuestion
  });
}

function searchDirectory(dir, ignoredDirArr,ignoredAppArr) {

  if (dir == undefined)
    return;

  const new_dir = fs.readdirSync(dir);
  return Promise.all(
    new_dir.map(async (item) => {
      try {
        const newDirPath = path.join(dir, item);
        const stats = fs.statSync(newDirPath);
        if (stats.isDirectory() && !ignoredDirArr.includes(newDirPath) && !ignoredAppArr.includes(newDirPath)) {
          return searchDirectory(newDirPath, ignoredDirArr, ignoredAppArr);
        } else if (stats.isFile()) {
          searchFile(newDirPath);
        } else {
          console.log("Unknown object type:", path.basename(newDirPath));
        }
      } catch (error) {
        console.log("Error occurred when searching for directories:", error);
      }
    })
  );
}

function searchFile(dir) {
  let stats = fs.statSync(dir);
  
  if (stats.isDirectory())
    return;
  
  let readFile = fs.readFileSync(dir, "utf8");
  const fileName = path.basename(dir);
  if (fileName === "package.json" && !filePaths.includes(dir)) {
    const usablefileName = JSON.parse(readFile);
    packageCount++;
    filePaths.push(dir);
    fileNames.push(usablefileName.name);
    console.log("Count:", packageCount, "DIR:", dir);
    writeFiletoJSON(filePaths,fileNames);
  }
}

function writeFiletoJSON(filePathArr, fileNameArr) {
  const file = './packageInfo.json';
  let existingDataDir = {};
  if (fs.existsSync(file)) {
    const fileContent = fs.readFileSync(file, 'utf8');
    if (fileContent) {
      existingDataDir = JSON.parse(fileContent);
    }
  }
  const newData = filePathArr.reduce((acc, item, index) => {
    const dirName = path.dirname(item);
    const filePath = fileNameArr[index];
    acc[filePath] = dirName;
    return acc;
  }, {});
  existingDataDir.packages = newData;
  packages = newData;
}

async function startZenith() {
console.log("---------------Zenith Terminal---------------\nType (x) to exit the terminal.");
  try {
      await appDirectory();
      await chooseDirectory();
      await optionalDir();
      await searchDirectory();
      writetoJSON(ignoredApps,ignoredDirectories,packages);

      userInput.removeAllListeners('line');
  } catch (error) {
    console.log("Error!!!\n---------\n",error);
    return;
  }
}

function removeDuplicate(arr)
{
  const tempArr = [];
  arr.forEach(element => {
    if (!tempArr.includes(element))
      tempArr.push(element);
  });
  return tempArr;
}

function writetoJSON(ignoredAppArr,ignoredDirArr,packagesArr){
  const data = {
    appDirectories: ignoredAppArr,
    packages: packagesArr,
    ignore: ignoredDirArr
  };

  fs.writeFile('./packageInfo.json', JSON.stringify(data, null, 2), (err) => {
    if (err)
      console.warn("Error occured while writing:", err);

    console.log("Data written successfully .");
  });
}

startZenith();
