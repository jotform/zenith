import { readFileSync, existsSync } from "fs";
import { SAVE_AS_TXT_KEYWORD } from "./constants";

export const readFileAsJSON = (path) => {
  if (existsSync(path)) {
    return JSON.parse(readFileSync(path, { encoding: "utf-8" }));
  }
  return {};
};

export const formatMissingProjects = (missingProjects) =>
  missingProjects.reduce((acc, curr) => {
    return acc + `\n${curr.buildProject} ${formatTimeDiff(curr.time)}`;
  }, "");

export const formatTimeDiff = (time) => {
  const seconds = (time[0] + time[1] / 1e9).toFixed(3);
  if (seconds > 60) {
    const minutes = Math.floor(seconds / 60);
    return `(${minutes}m ${(seconds % 60).toFixed(3)}s)`;
  }
  return `(${seconds}s)`;
};

// output is expected to be a string or array of strings
export const isOutputTxt = (output) => {
  if (typeof output === 'string') return output === SAVE_AS_TXT_KEYWORD;
  return output.includes(SAVE_AS_TXT_KEYWORD)
}