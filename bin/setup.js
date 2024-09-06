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

    const appCallback = (appEventListener) => {// appEventListener == user output && appCallback == userInput
      if (appEventListener.length === 1 && appEventListener.toLowerCase().includes('x')) {
        userInput.removeListener('line', appCallback);

        userInput.question("\nAre you sure about all the directories? (y/n)", (appDirCheck) => {
          if (appDirCheck.toLowerCase() === 'y') { //User entered all directories
            ignoredAppArr.push(...tempAppArr);
            console.log("\nYour app directories\n------------------\n", ignoredAppArr);
            writeAppDirJSON(ignoredAppArr); // Go to write
            resolveAppDir("Taking app directory is done.");//True Promise
            userInput.removeListener('line', appCallback);//make clean userInput for second function

          } else if (appDirCheck.toLowerCase() === 'n') {//User wants to enter new app directories
            userInput.question("Do you want to quit adding app directories? (y for quitting)\n", (quitApp) => {
              if (quitApp.toLowerCase() === 'y') {
                tempAppArr = [];
                resolveAppDir("Quitted adding app directories.");//True Promise
                userInput.removeListener('line', appCallback);
              } else {
                console.log("You have entered to continue."); //False Promise
                userInput.on('line', appCallback);
              }
            });//userQuestion (All directories ?)
          } else {
            rejectAppDir("Invalid input provided."); // Return false promise value
          }
        });
      } else {
        console.log("New app directory added.");
        tempAppArr.push(appEventListener);
        console.log("\nCurrent App Directories\n-----------------------------\n", tempAppArr);
      }
    };//userInput (callback)
    userInput.on('line', appCallback);
  });//Promise
}

function writeAppDirJSON(appDir) //takeAppDir içinde
{
  const file = './packageInfo.json';

  let existingDataApp = {};
  if (fs.existsSync(file)) {
    const fileContent = fs.readFileSync(file, 'utf8');
    if (fileContent) {
      existingDataApp = JSON.parse(fileContent); // Mevcut verileri al
    }
  }

  existingDataApp.appDirectories = appDir;
  ignoredAppArr = appDir;

}//writeAppJSON


function chooseDirectory() {//(2)
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
    };//userInput

    userInput.on('line',takeGitCallback);
  });//promise
}//chooseDirectory

function optionalDir() {//chooseDir içinde
  return new Promise ((resolveOptDir,rejectOptDir) => {
    userInput.question("Is there any directories you want to ignore ? (Write \"yes\" to add new directories, else will quit adding new directories.)\nChoice:", userChoice => {
      if (userChoice.toLowerCase() === "yes") {
        const optDirCallback = (optDirUserInput) => {
          if (optDirUserInput.length == 1 && optDirUserInput.toLowerCase().includes('x')) {// check if user quits
            userInput.removeListener('line',optDirCallback);
            console.log("-Current ignored directories-\n", ignoredDirArr, "\n----------------------------\n"
                       ,"-Newly added directories-\n", tempDirArr);
            userInput.question("Do you want to ignore these directories ? (Y/N):", (userChoice) => {
              //----------------------------------------------------------------------------------------------------//
              if (userChoice.length == 1 && userChoice.toLowerCase().includes('y')) {//user entered all directories (quit optionalDir)
                ignoredDirArr.push(...tempDirArr);//pushes tempDir's values
                resolveOptDir("Optional directories is done.Ignored directories\n---------------------------------\n", ignoredDirArr);

                /*+-----+*/searchDir('.',ignoredDirArr,ignoredAppArr);/*+-----+*/

                //userInput.removeListener('line',optDirCallback);
              } else if (userChoice.length == 1 && userChoice.toLowerCase().includes('n')) {//user wants to enter more or quit to add extra directories
                tempDirArr = [];

                userInput.question("Select more or quit ? (M/Q)", (userChoice) => {
                  if (userChoice.length == 1 && userChoice.toLowerCase().includes('m')) {
                    console.log("You have selected to continue.");
                    userInput.on('line',optDirCallback);
                  } else if (userChoice.length == 1 && userChoice.toLowerCase().includes('q')) {//quit optionalDir
                    resolveOptDir("You have selected to quit adding more directories. Current directories to be ignored:", ignoredDirArr);

                    /*+-----+*/searchDir('.',ignoredDirArr,ignoredAppArr)/*+-----+*/;

                    //userInput.removeListener('line',optDirCallback);
                  } else {//quit optionalDir
                    rejectOptDir("Wrong input detected. Zenith will end now.");
                    userInput.off('line',optDirCallback);
                  }
                });//userInput.question (M/Q)

              }
              else 
                console.log("Wrong input detected.");
              //----------------------------------------------------------------------------------------------------//
            });//outer userQuestion
          } else { //outer (main -x input-) if
            tempDirArr.push(optDirUserInput);
            console.log("Current ignored directories:", tempDirArr)
          }
        }//userInput (callback)
        userInput.on('line',optDirCallback);//start taking input
      }//outer (answer == yes) if
      else {
        console.log("You have selected to quit adding more directories. Current directories to be ignored:", ignoredDirArr);
        /*+-----+*/searchDir('.',ignoredDirArr,ignoredAppArr);/*+-----+*/
      }
    });//userQuestion ()
  })//promise
}//optionalDir

function searchDir(dir, ignoredDirArr,ignoredAppArr) {//
  const new_dir = fs.readdirSync(dir);//dir = current dir we are searching, newDir = result of the directories in "dir" in string array
  for (const item of new_dir) {
    try {
      let newDirPath = path.join(dir, item);
      const stats = fs.statSync(newDirPath);//newDirPath = current object (it can be dir or file)
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
}//searchDir(with arr)

function searchFile(dir) { //searchDir içinde
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
}//searchFile

function writeFiletoJSON(filePathArr, fileNameArr) { //(4)
  const file = './packageInfo.json';

  let existingDataDir = {};
  if (fs.existsSync(file)) {
    const fileContent = fs.readFileSync(file, 'utf8');
    if (fileContent) {
      existingDataDir = JSON.parse(fileContent);
    }
  }

  const newData = filePathArr.reduce((acc, item, index) => {
    const dirName = path.dirname(item);//dirname --> gets path, basename --> gets last part
    const filePath = fileNameArr[index];
    acc[filePath] = dirName;//item - index
    return acc;
  }, {}); // {} == başlangıç değerine ait boş nesne ?

  existingDataDir.packages = newData;
  packagesArr = newData;

}//writeFileJSON

async function startZenith() {
console.log("---------------Zenith Terminal---------------\nType (x) to exit the terminal.");
  try {
      await takeAppDir();//start first function, await for its promise
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


