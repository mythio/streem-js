import chalk from "chalk";

import { config } from "./config";

enum LOG_LEVEL {
	NONE = 0,
	ERROR = 1,
	WARN = 2,
	INFO = 3,
	DEBUG = 4
}

const logLevel = LOG_LEVEL[config.LOG_LEVEL];

const getLocaleTime = (): string => {
	const date = new Date();
	return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour12: false })}`;
};

const error = (message: string): void => {
	if (logLevel < LOG_LEVEL.ERROR) return;

	console.log(`[${getLocaleTime()}] ${chalk.bold.redBright(`E: ${message}`)}`);
};

const warn = (message: string): void => {
	if (logLevel < LOG_LEVEL.ERROR) return;

	console.log(`[${getLocaleTime()}] ${chalk.bold.yellowBright(`W: ${message}`)}`);
};

const info = (message: string): void => {
	if (logLevel < LOG_LEVEL.ERROR) return;

	console.log(`[${getLocaleTime()}] ${chalk.bold.whiteBright(`I: ${message}`)}`);
};

const debug = (message: string): void => {
	if (logLevel < LOG_LEVEL.ERROR) return;

	console.log(`[${getLocaleTime()}] ${chalk.bold.blueBright(`D: ${message}`)}`);
};

export const logger = {
	error: error,
	warn: warn,
	info: info,
	debug: debug
};
