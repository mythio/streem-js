import { EventEmitter } from "events";

const sessions = new Map();
const publishers = new Map();
const idlePlayers = new Set();
const nodeEvent = new EventEmitter();
const statistics = {
	inBytes: 0,
	outBytes: 0
};

export const ctx = {
	sessions,
	publishers,
	idlePlayers,
	nodeEvent,
	statistics
};
