import { EventEmitter } from "events";

import { generateS0S1S2 } from "./handshake";
import BufferPool from "../core/bufferPool";
import amf from "./amf0";
import { log } from "../config/logger";

export default class Connection extends EventEmitter {
	id: any;
	socket: any;
	conns: any;
	consumers: Buffer[];
	producers: any;
	rtmpStatus: number;
	isStarting: boolean;
	inChunkSize: number;
	outChunkSize: number;
	previousChunkMessage: {};
	connectCmdObj: any;
	isFirstAudioReceived: boolean;
	isFirstVideoReceived: boolean;
	lastAudioTimestamp: number;
	lastVideoTimestamp: number;
	playStreamName: string;
	publishStreamName: string;
	bp: BufferPool;
	parser: any;
	codec: {
		width: number;
		height: number;
		duration: number;
		framerate: number;
		videodatarate: number;
		audiosamplerate: number;
		audiosamplesize: number;
		audiodatarate: number;
		spsLen: number;
		sps: any;
		ppsLen: number;
		pps: any;
	};
	sendBufferQueue: any[];

	constructor(id, socket, conns, producers) {
		super();

		this.id = id;
		this.socket = socket;
		this.conns = conns;
		this.producers = producers;
		this.rtmpStatus = 0;
		this.isStarting = false;
		this.inChunkSize = 128;
		this.outChunkSize = 128;
		this.previousChunkMessage = {};
		this.connectCmdObj = null;
		this.isFirstAudioReceived = true;
		this.isFirstVideoReceived = true;
		this.lastAudioTimestamp = 0;
		this.lastVideoTimestamp = 0;

		this.playStreamName = "";
		this.publishStreamName = "";

		this.bp = new BufferPool(undefined);
		this.bp._read = () => {};
		this.bp.on("error", () => {});

		this.parser = parseRtmpMessage(this);

		this.codec = {
			width: 0,
			height: 0,
			duration: 0,
			framerate: 0,
			videodatarate: 0,
			audiosamplerate: 0,
			audiosamplesize: 0,
			audiodatarate: 0,
			spsLen: 0,
			sps: null,
			ppsLen: 0,
			pps: null
		};

		this.sendBufferQueue = [];
	}

	generateSessionId(): void {
		this.isStarting = true;
		this.bp.init(this.parser);
	}

	create(): void {
		this.isStarting = true;
		this.bp.init(this.parser);
	}

	stop() {
		this.isStarting = false;
		if (this.publishStreamName != "") {
			// delete producers
		} else if (this.playStreamName != "") {
			// delete consumer
		}

		delete this.conns[this.id];

		this.emit("stop");
	}

	public getRealChunkSize(bodySize: number, chunkSize: number) {
		const length = bodySize + Math.floor(bodySize / chunkSize);
		if (bodySize % chunkSize) {
			return length;
		} else {
			return length - 1;
		}
	}

	public createRtmpMessage(header, body) {
		const formatId = 0;
		const bodySize = body.length;

		if (!header.chunkStreamID)
			log("WARN", `createRtmpMessage(): chunkStreamId is not set for RTMP`);
		if (!header.timestamp)
			log("WARN", `createRtmpMessage(): timestamp is not set for RTMP message`);
		if (!header.messageTypeID)
			log("WARN", `createRtmpMessage(): messageTypeID is not set for RTMP message`);
		if (!header.messageStreamID)
			log("WARN", `createRtmpMessage(): messageStreamID is not set for RTMP message`);

		let useExtendedTimestamp = false;
		let timestamp;

		if (header.timestamp >= 0xffffff) {
			useExtendedTimestamp = true;
			timestamp = [0xff, 0xff, 0xff];
		} else {
			timestamp = [
				(header.timestamp >> 16) & 0xff,
				(header.timestamp >> 8) & 0xff,
				header.timestamp & 0xff
			];
		}

		let buffers = Buffer.from([
			(header.timestamp >> 24) & 0xff,
			(header.timestamp >> 16) & 0xff,
			(header.timestamp >> 8) & 0xff,
			header.timestamp & 0xff
		]);

		if (useExtendedTimestamp) {
			const extendedTimestamp = Buffer.from([
				(header.timestamp >> 24) & 0xff,
				(header.timestamp >> 16) & 0xff,
				(header.timestamp >> 8) & 0xff,
				header.timestamp & 0xff
			]);
			buffers = Buffer.concat([buffers, extendedTimestamp]);
		}

		const bodyPos = 0;
		const chunkBody = [];
		const type3Header = Buffer.from([(3 << 6) | header.chunkStreamID]);

		do {
			// @TODO push from rtmp body to chunk
		} while (bodySize > 0);

		const chunkBodyBuffer = Buffer.concat(chunkBody);
		buffers = Buffer.concat([buffers, chunkBodyBuffer]);

		return buffers;
	}
}
