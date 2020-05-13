import chalk from "chalk";
import * as config from "./";

enum LOG_LEVEL {
	NONE = 0,
	ERROR = 1,
	WARN = 2,
	INFO = 3,
	DEBUG = 4
}

type Log = keyof typeof LOG_LEVEL;

const logLevel = LOG_LEVEL[config.LOG_LEVEL];

const getLocaleTime = (): string => {
	const date = new Date();
	return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour12: false })}`;
};

export const log = (logType: Log, ...args: string[]): void => {
	switch (LOG_LEVEL[logType]) {
		case 1: {
			if (logLevel < LOG_LEVEL.ERROR) return;
			console.log(getLocaleTime, process.pid, chalk.bold.bgRedBright("E: "), ...args);
			break;
		}
		case 2: {
			if (logLevel < LOG_LEVEL.WARN) return;
			console.log(getLocaleTime, process.pid, chalk.bold.bgYellowBright("W: "), ...args);
			break;
		}
		case 3: {
			if (logLevel < LOG_LEVEL.INFO) return;
			console.log(getLocaleTime, process.pid, chalk.bold.bgGreenBright("I: "), ...args);
			break;
		}
		case 4: {
			if (logLevel < LOG_LEVEL.DEBUG) return;
			console.log(getLocaleTime, process.pid, chalk.bold.bgBlueBright("D: "), ...args);
		}
		default:
			break;
	}
};
