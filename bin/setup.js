#!/usr/bin/node

const { dir } = require("console");
const fs = require("fs");
const path = require("path");
const { Readline } = require("readline/promises");

const userInput = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
});

const filePathArr = [];
const fileNameArr = [];
const ignoredDirArr = [];
const ignoredAppArr = [];
const packagesArr = [];

let tempDirArr = [];
let tempAppArr = [];
let package_count = 0;


ignoredDirArr.push("node_modules");
ignoredDirArr.push(".git");

function takeAppDir() {
  return new Promise((resolveAppDir, rejectAppDir) => {
    console.log("App directories ? (x for quit adding new directories)");

    const appCallback = (appEventListener) => {
      if (appEventListener.length === 1 && appEventListener.toLowerCase().includes('x')) {
        userInput.removeListener('line', appCallback);

        userInput.question("\nAre you sure about all the directories? (y/n)", (appDirCheck) => {
          if (appDirCheck.toLowerCase() === 'y') {
            ignoredAppArr.push(...tempAppArr);
            console.log("\nYour app directories\n------------------\n", ignoredAppArr);
            writeAppDirJSON(ignoredAppArr);
            resolveAppDir("Taking app directory is done.");
            userInput.removeListener('line', appCallback);

          } else if (appDirCheck.toLowerCase() === 'n') {
            userInput.question("Do you want to quit adding app directories? (y for quitting)\n", (quitApp) => {
              if (quitApp.toLowerCase() === 'y') {
                tempAppArr = [];
                resolveAppDir("Quitted adding app directories.");
                userInput.removeListener('line', appCallback);
              } else {
                console.log("You have entered to continue.");
                userInput.on('line', appCallback);
              }
            });
          } else {
            rejectAppDir("Invalid input provided.");
          }
        });
      } else {
        console.log("New app directory added.");
        tempAppArr.push(appEventListener);
        console.log("\nCurrent App Directories\n-----------------------------\n", tempAppArr);
      }
    };
    userInput.on('line', appCallback);
  });
}

function writeAppDirJSON(appDir)
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
  ignoredAppArr = appDir;

}


function chooseDirectory() {
  return new Promise ((resolveDir) => {
    console.log("Do you want to ignore .github (x = no, y = yes)");
    const takeGitCallback = (takeGitInput) => {
      userInput.removeListener('line',takeGitCallback);
      takeGitInput.toLowerCase();
      console.log("Choice-->", takeGitInput);
      if (takeGitInput === "x") {
        console.log("You have selected to \"not\" ignore the .github");
        resolveDir("Github section closed.");
      }
      else if (takeGitInput === "y" || takeGitInput === "yes") {
        ignoredDirArr.push(".github");
        console.log("You have selected to ignore .github");
        resolveDir("Github section closed.");
      }
      else
      {
        console.log("Wrong input detected, new one required.");
        userInput.on('line',takeGitCallback);
      }
    };

    userInput.on('line',takeGitCallback);
  });
}

function optionalDir() {
  return new Promise ((resolveOptDir,rejectOptDir) => {
    userInput.question("Is there any directories you want to ignore ? (Write \"yes\" to add new directories, else will quit adding new directories.)\nChoice:", userChoice => {
      if (userChoice.toLowerCase() === "yes") {
        const optDirCallback = (optDirUserInput) => {
          if (optDirUserInput.length == 1 && optDirUserInput.toLowerCase().includes('x')) {
            userInput.removeListener('line',optDirCallback);
            console.log("-Current ignored directories-\n", ignoredDirArr, "\n----------------------------\n"
                       ,"-Newly added directories-\n", tempDirArr);
            userInput.question("Do you want to ignore these directories ? (Y/N):", (userChoice) => {
              //----------------------------------------------------------------------------------------------------//
              if (userChoice.length == 1 && userChoice.toLowerCase().includes('y')) {
                ignoredDirArr.push(...tempDirArr);
                resolveOptDir("Optional directories is done.Ignored directories\n---------------------------------\n", ignoredDirArr);
                
                searchDir('.',ignoredDirArr,ignoredAppArr);
                
              } else if (userChoice.length == 1 && userChoice.toLowerCase().includes('n')) {//user wants to enter more or quit to add extra directories
                tempDirArr = [];

                userInput.question("Select more or quit ? (M/Q)", (userChoice) => {
                  if (userChoice.length == 1 && userChoice.toLowerCase().includes('m')) {
                    console.log("You have selected to continue.");
                    userInput.on('line',optDirCallback);
                  } else if (userChoice.length == 1 && userChoice.toLowerCase().includes('q')) {//quit optionalDir
                    resolveOptDir("You have selected to quit adding more directories. Current directories to be ignored:", ignoredDirArr);

                    searchDir('.',ignoredDirArr,ignoredAppArr);

                  } else {
                    rejectOptDir("Wrong input detected. Zenith will end now.");
                    userInput.off('line',optDirCallback);
                  }
                });

              }
              else 
                console.log("Wrong input detected.");
            });
          } else {
            tempDirArr.push(optDirUserInput);
            console.log("Current ignored directories:", tempDirArr)
          }
        }
        userInput.on('line',optDirCallback);
      }
      else {
        console.log("You have selected to quit adding more directories. Current directories to be ignored:", ignoredDirArr);
        searchDir('.',ignoredDirArr,ignoredAppArr);
      }
    });
  })
}

function searchDir(dir, ignoredDirArr,ignoredAppArr) {
  const new_dir = fs.readdirSync(dir);
  for (const item of new_dir) {
    try {
      let newDirPath = path.join(dir, item);
      const stats = fs.statSync(newDirPath);
      if (stats.isDirectory() && !ignoredDirArr.includes(newDirPath) && !ignoredAppArr.includes(newDirPath))
        searchDir(newDirPath, ignoredDirArr,ignoredAppArr);
  
      else if (stats.isFile())
        searchFile(newDirPath);
  
      else {
        if (ignoredAppArr.includes(newDirPath) || ignoredDirArr.includes(newDirPath))
          console.log("Unknown object type:" + path.basename(newDirPath));
        continue;
      }
    } catch (error) {
      console.log("Error occured when searchin for directories:",error);
    }
  }
}

function searchFile(dir) {
  const stats = fs.statSync(dir);
  if (stats.isDirectory())
    return;

  const readFile = fs.readFileSync(dir, "utf8");
  const fileName = path.basename(dir);

  if (fileName === "package.json" && !filePathArr.includes(dir)) {
    const usablefileName = JSON.parse(readFile);
    package_count++;
    filePathArr.push(dir);
    fileNameArr.push(usablefileName.name);
    console.log("Count:", package_count, "DIR:", dir);
    writeFiletoJSON(filePathArr,fileNameArr);
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
  packagesArr = newData;

}

async function startZenith() {
console.log("---------------Zenith Terminal---------------\nType (x) to exit the terminal.");
  try {
      await takeAppDir();
      await chooseDirectory();
      await optionalDir();
      writetoJSON(ignoredAppArr,ignoredDirArr,packagesArr);
      userInput.removeAllListeners('line');
  } catch (error) {
    console.log("Error!!!\n---------\n",error);
    return;
  }
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


