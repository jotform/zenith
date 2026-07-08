export const hrtimeToMs = (time: [number, number]): number => time[0] * 1e3 + time[1] / 1e6;
