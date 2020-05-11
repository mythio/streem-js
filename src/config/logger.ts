import { injectable } from "inversify";
import chalk from "chalk";

enum LOG_LEVEL {
	NONE = 0,
	ERROR = 1,
	INFO = 2,
	DEBUG = 3
}

type Log = keyof typeof LOG_LEVEL;

@injectable()
export class Logger {
	private _logLevel: LOG_LEVEL;

	constructor(logLevel: LOG_LEVEL) {
		this._logLevel = logLevel;
	}

	private getLocaleTime(): string {
		const date = new Date();
		return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour12: false })}`;
	}

	public log(logType: Log, ...args: string[]): void {
		switch (LOG_LEVEL[logType]) {
			case 1: {
				if (this._logLevel < LOG_LEVEL.ERROR) return;
				console.log(this.getLocaleTime, process.pid, chalk.bold.bgRedBright("E: "), ...args);
				break;
			}
			case 2: {
				if (this._logLevel < LOG_LEVEL.INFO) return;
				console.log(this.getLocaleTime, process.pid, chalk.bold.bgGreenBright("I: "), ...args);
				break;
			}
			case 3: {
				if (this._logLevel < LOG_LEVEL.DEBUG) return;
				console.log(this.getLocaleTime, process.pid, chalk.bold.bgBlueBright("D: "), ...args);
				break;
			}
			default:
				break;
		}
	}
}
