/* eslint-disable @typescript-eslint/camelcase */
import { EventEmitter } from "events";

import amf from "../core/amf0";
import { logger } from "../config/logger";
import BufferPool from "../core/bufferPool";
import { parseMessage } from "../core/utils";
import { AAC_SAMPLE_RATES } from "../constant/aac";

export default class Connection extends EventEmitter {
	id: any;
	socket: any;
	conns: any;
	producers: Connection;
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
	parser: Generator<any, void, unknown>;
	codec: any;
	sendBufferQueue: any[];
	consumers: any;
	app: any;
	objectEncoding: any;
	producer: any;

	constructor(id, socket, conns, producers: Connection) {
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
		this.bp = new BufferPool(null);
		this.sendBufferQueue = [];

		this.bp._read = (): void => {
			return;
		};
		this.bp.on("error", () => {
			return;
		});

		this.parser = parseMessage(this);

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
	}

	public run(): void {
		this.isStarting = true;
		this.bp.init(this.parser);
	}

	public stop(): void {
		this.isStarting = false;

		if (this.publishStreamName != "") {
			logger.debug(`Send EOF to consumers of publisher ${this.publishStreamName}.`);

			for (const id in this.consumers) {
				this.consumers[id].sendStreamEOF();
			}

			logger.debug(`Delete publisher ${this.publishStreamName} from producers.`);
			delete this.producers[this.publishStreamName];
		} else if (this.playStreamName != "") {
			if (this.producers[this.playStreamName]) {
				logger.debug(`Delete player ${this.playStreamName} from consumers.`);
				delete this.producers[this.playStreamName].consumers[this.id];
			}
		}

		logger.debug(`Delete client from connections ID ${this.id}.`);
		delete this.conns[this.id];

		this.emit("stop");
	}

	public getRealChunkSize(bodySize: number, chunkSize: number): number {
		const size = bodySize + Math.floor(bodySize / chunkSize);

		if (bodySize % chunkSize) {
			return size;
		} else {
			return size - 1;
		}
	}

	public createMessage(header: any, body: Buffer): Buffer {
		const formatTypeId = 0;
		let bodyLength = body.length;

		if (
			header.chunkStreamId == null ||
			header.timestamp == null ||
			header.messageTypeId == null ||
			header.messageStreamId == null
		) {
			logger.warn("Header is not complete for RTMP.");
		}

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

		let buffer = Buffer.from([
			(formatTypeId << 6) | header.chunkStreamId,
			timestamp[0],
			timestamp[1],
			timestamp[2],
			(bodyLength >> 16) & 0xff,
			(bodyLength >> 8) & 0xff,
			bodyLength & 0xff,
			header.messageTypeId,
			header.messageStreamId & 0xff,
			(header.messageStreamId >>> 8) & 0xff,
			(header.messageStreamId >>> 16) & 0xff,
			(header.messageStreamId >>> 24) & 0xff
		]);

		if (useExtendedTimestamp) {
			const extendedTimestamp = Buffer.from([
				(header.timestamp >> 24) & 0xff,
				(header.timestamp >> 16) & 0xff,
				(header.timestamp >> 8) & 0xff,
				header.timestamp & 0xff
			]);
			buffer = Buffer.concat([buffer, extendedTimestamp]);
		}

		let bodyPos = 0;
		const chunkBody = [];
		const type3Header = Buffer.from([(3 << 6) | header.chunkStreamId]);

		do {
			if (bodyLength > this.outChunkSize) {
				chunkBody.push(body.slice(bodyPos, bodyPos + this.outChunkSize));
				bodyLength -= this.outChunkSize;
				bodyPos += this.outChunkSize;
				chunkBody.push(type3Header);
			} else {
				chunkBody.push(body.slice(bodyPos, bodyPos + bodyLength));
				bodyLength -= bodyLength;
				bodyPos += bodyLength;
			}
		} while (bodyLength > 0);

		const chunkBodyBuffer = Buffer.concat(chunkBody);
		buffer = Buffer.concat([buffer, chunkBodyBuffer]);

		return buffer;
	}

	public handleMessage(header: any, body: Buffer): void {
		switch (header.messageTypeId) {
			// set packet size message
			case 0x01: {
				this.inChunkSize = body.readUInt32BE(0);
				break;
			}
			// control message
			case 0x04: {
				break;
			}
			// audio packet
			case 0x08: {
				this.parseAudioMessage(header, body);
				break;
			}
			// video packet
			case 0x09: {
				this.parseVideoMessage(header, body);
				break;
			}
			// data extended
			case 0x0f: {
				const cmd = amf.decode(body.slice(1));
				this.handleAmfDataMessage(cmd);
				break;
			}
			// command extended
			case 0x11: {
				const cmd = amf.decode(body.slice(1));
				this.handleAmfCommandMessage(cmd);
				break;
			}
			// data
			case 0x12: {
				const cmd = amf.decode(body);
				this.handleAmfDataMessage(cmd);
				break;
			}
			// command
			case 0x14: {
				const cmd = amf.decode(body);
				this.handleAmfCommandMessage(cmd);
				break;
			}
		}
	}

	public handleAmfDataMessage(cmd: any): void {
		this.receiveSetDataFrame(cmd.method, cmd.cmdObj);
	}

	public handleAmfCommandMessage(cmd: any): void {
		this.emit("command", cmd);

		switch (cmd.cmd) {
			case "connect": {
				logger.info(`RTMP: Connect app ${cmd.cmdObj.app}.`);

				this.connectCmdObj = cmd.cmdObj;
				this.app = this.connectCmdObj.app;
				this.objectEncoding = cmd.cmdObj.objectEncoding != null ? cmd.cmdObj.objectEncoding : 0;
				this.windowACK(5000000);
				this.setPeerBandwidth(5000000, 2);
				this.outChunkSize = 4096;
				this.setChunkSize(this.outChunkSize);

				this.emit("connect", cmd);
				this.respondConnect();
				break;
			}
			case "createStream": {
				this.respondCreateStream(cmd);
				break;
			}
			case "play": {
				logger.info(`RTMP: Play stream ${cmd.streamName}.`);

				const streamName = this.connectCmdObj.app + "/" + cmd.streamName;
				this.playStreamName = streamName;

				this.emit("play", cmd);
				this.respondPlay();

				if (!this.producers[streamName]) {
					logger.warn(`RTMP: No stream named ${streamName}.`);

					this.producers[streamName] = {
						id: null,
						consumers: {}
					};
				}
				this.producers[streamName].consumers[this.id] = this;
				this.startPlay();
				break;
			}
			case "publish": {
				logger.info(`RTMP: Publish stream ${cmd.streamName}.`);
				const streamName = this.connectCmdObj.app + "/" + cmd.streamName;
				if (!this.producers[streamName]) {
					this.producers[streamName] = {
						id: this.id,
						consumers: {}
					};
				} else if (this.producers[streamName].id == null) {
					this.producers[streamName].id = this.id;
				} else {
					this.respondPublishError();
					return;
				}
				this.publishStreamName = streamName;
				this.producer = this.producers[streamName];
				this.consumers = this.producer.consumers;

				this.emit("publish", cmd);
				this.respondPublish();
				break;
			}
			default:
				return;
		}
	}

	public windowACK(size: number): void {
		const buffer = Buffer.from("02000000000004050000000000000000", "hex");
		buffer.writeUInt32BE(size, 12);
		this.socket.write(buffer);
	}

	public setPeerBandwidth(size: number, type: number): void {
		const buffer = Buffer.from("0200000000000506000000000000000000", "hex");
		buffer.writeUInt32BE(size, 12);
		buffer[16] = type;
		this.socket.write(buffer);
	}

	public setChunkSize(size: number): void {
		const buffer = Buffer.from("02000000000004010000000000000000", "hex");
		buffer.writeUInt32BE(size, 12);
		this.socket.write(buffer);
	}

	public respondConnect(): void {
		const header = {
			chunkStreamId: 3,
			timestamp: 0,
			messageTypeId: 0x14,
			messageStreamId: 0
		};
		const opt = {
			cmd: "_result",
			transId: 1,
			cmdObj: {
				fmsVer: "FMS/3,0,1,123",
				capabilities: 31
			},
			info: {
				level: "status",
				code: "NetConnection.Connect.Success",
				description: "Connection succeeded.",
				objectEncoding: this.objectEncoding
			}
		};

		this.writeToSocket(header, opt);
	}

	public respondCreateStream(cmd: any): void {
		const header = {
			chunkStreamId: 3,
			timestamp: 0,
			messageTypeId: 0x14,
			messageStreamId: 0
		};
		const opt = {
			cmd: "_result",
			transId: cmd.transId,
			cmdObj: null,
			info: 1
		};

		this.writeToSocket(header, opt);
	}

	public respondPlay(): void {
		this.amfCommand();
		this.amfData();
	}

	private amfCommand(): void {
		const header = {
			chunkStreamId: 3,
			timestamp: 0,
			messageTypeId: 0x14,
			messageStreamId: 1
		};
		const opt = {
			cmd: "onStatus",
			transId: 0,
			cmdObj: null,
			info: {
				level: "status",
				code: "NetStream.Play.Start",
				description: "Start live"
			}
		};

		this.writeToSocket(header, opt);
	}

	private amfData(): void {
		const header = {
			chunkStreamId: 5,
			timestamp: 0,
			messageTypeId: 0x12,
			messageStreamId: 1
		};
		const opt = {
			cmd: "|RtmpSampleAccess",
			bool1: true,
			bool2: true
		};

		this.writeToSocket(header, opt);
	}

	private writeToSocket(header, opt): void {
		const body = amf.encode(opt);
		const message = this.createMessage(header, body);
		this.socket.write(message);
	}

	public startPlay(): void {
		const producer = this.producers[this.playStreamName];

		if (
			producer.metaData == null ||
			producer.cacheAudioSequenceBuffer == null ||
			producer.cacheVideoSequenceBuffer == null
		)
			return;

		const metadata = this.getMetadataMessage(producer.metaData);
		const audioSeq = this.getAudioSequenceMessage(producer.cacheAudioSequenceBuffer);
		const videoSeq = this.getVideoSequenceMessage(producer.cacheVideoSequenceBuffer);

		const beginRtmpMessage = Buffer.from("020000000000060400000000000000000001", "hex");
		this.sendBufferQueue.push(beginRtmpMessage);
		this.sendBufferQueue.push(metadata);
		this.sendBufferQueue.push(audioSeq);
		this.sendBufferQueue.push(videoSeq);

		this.sendMessage(this);
	}

	private getMetadataMessage(metadata: any): Buffer {
		const header = {
			chunkStreamId: 5,
			timestamp: 0,
			messageTypeId: 0x12,
			messageStreamId: 1
		};

		const opt = {
			cmd: "onMetaData",
			cmdObj: metadata
		};

		const rtmpBody = amf.encode(opt);

		return this.createMessage(header, rtmpBody);
	}

	private getAudioSequenceMessage(cacheAudioSequenceBuffer: Buffer): Buffer {
		const header = {
			chunkStreamId: 4,
			timestamp: 0,
			messageTypeId: 0x08,
			messageStreamId: 1
		};

		return this.createMessage(header, cacheAudioSequenceBuffer);
	}

	private getVideoSequenceMessage(cacheVideoSequenceBuffer): Buffer {
		const header = {
			chunkStreamId: 4,
			timestamp: 0,
			messageTypeId: 0x09,
			messageStreamId: 1
		};

		return this.createMessage(header, cacheVideoSequenceBuffer);
	}

	public respondPublish(): void {
		const header = {
			chunkStreamId: 5,
			timestamp: 0,
			messageTypeId: 0x14,
			messageStreamId: 1
		};
		const opt = {
			cmd: "onStatus",
			transId: 0,
			cmdObj: null,
			info: {
				level: "status",
				code: "NetStream.Publish.Start",
				description: "Start publishing"
			}
		};

		this.writeToSocket(header, opt);
	}

	public respondPublishError(): void {
		const header = {
			chunkStreamId: 5,
			timestamp: 0,
			messageTypeId: 0x14,
			messageStreamId: 1
		};
		const opt = {
			cmd: "onStatus",
			transId: 0,
			cmdObj: null,
			info: {
				level: "error",
				code: "NetStream.Publish.BadName",
				description: "Already publishing"
			}
		};

		this.writeToSocket(header, opt);
	}

	public receiveSetDataFrame(method: string, obj: any): void {
		if (method == "onMetaData") {
			this.producers[this.publishStreamName].metaData = obj;
		}
	}

	public parseAudioMessage(header: any, body: Buffer): void {
		if (this.isFirstAudioReceived) {
			let sound_format = body[0];
			sound_format = (sound_format >> 4) & 0x0f;

			if (sound_format != 10) {
				this.emit("error", new Error(`Only support audio aac codec. actual=${sound_format}.`));
				return;
			}

			const aac_packet_type = body[1];

			if (aac_packet_type == 0) {
				this.codec.aac_profile = body[2];
				this.codec.aac_sample_rate = body[3];

				this.codec.aac_channels = (this.codec.aac_sample_rate >> 3) & 0x0f;
				this.codec.aac_sample_rate =
					((this.codec.aac_profile << 1) & 0x0e) | ((this.codec.aac_sample_rate >> 7) & 0x01);
				this.codec.aac_profile = (this.codec.aac_profile >> 3) & 0x1f;
				this.codec.audiosamplerate = AAC_SAMPLE_RATES[this.codec.aac_sample_rate];

				if (this.codec.aac_profile == 0 || this.codec.aac_profile == 0x1f) {
					this.emit("error", new Error(`Failed to parse audio AAC sequence header.`));
					return;
				}

				this.codec.aac_profile--;
				this.isFirstAudioReceived = false;
				this.producer.cacheAudioSequenceBuffer = Buffer.from(body);

				for (const id in this.consumers) {
					this.consumers[id].startPlay();
				}
			}
		} else {
			const sendHeader = {
				chunkStreamId: 4,
				timestamp: header.timestamp,
				messageTypeId: 0x08,
				messageStreamId: 1
			};
			const message = this.createMessage(sendHeader, body);

			for (const id in this.consumers) {
				this.consumers[id].sendBufferQueue.push(message);
			}
		}
	}

	public parseVideoMessage(header, body): void {
		let index = 0;
		let frame_type = body[0];
		const codec_id = frame_type & 0x0f;
		frame_type = (frame_type >> 4) & 0x0f;

		if (codec_id != 7) {
			this.emit("error", new Error("Only H.264/AVC codec supported."));
			return;
		}

		const avc_packet_type = body[1];

		if (avc_packet_type == 0) {
			if (this.isFirstVideoReceived) {
				this.codec.avc_profile = body[6];
				this.codec.avc_level = body[8];

				let lengthSizeMinusOne = body[9];
				lengthSizeMinusOne &= 0x03;
				this.codec.NAL_unit_length = lengthSizeMinusOne;

				// SPS
				let numOfSequenceParameterSets = body[10];
				numOfSequenceParameterSets &= 0x1f;

				if (numOfSequenceParameterSets != 1) {
					this.emit("error", new Error("Decode video AVC sequence header SPS failed."));
					return;
				}

				this.codec.spsLen = body.readUInt16BE(11);

				index = 13;
				if (this.codec.spsLen > 0) {
					this.codec.sps = Buffer.alloc(this.codec.spsLen);
					body.copy(this.codec.sps, 0, 13, 13 + this.codec.spsLen);
				}

				// PPS
				index += this.codec.spsLen;
				let numOfPictureParameterSets = body[index];
				numOfPictureParameterSets &= 0x1f;

				if (numOfPictureParameterSets != 1) {
					this.emit("error", new Error("Decode video avc sequenc header pps failed."));
					return;
				}

				index++;
				this.codec.ppsLen = body.readUInt16BE(index);
				index += 2;

				if (this.codec.ppsLen > 0) {
					this.codec.pps = Buffer.alloc(this.codec.ppsLen);
					body.copy(this.codec.pps, 0, index, index + this.codec.ppsLen);
				}

				this.isFirstVideoReceived = false;

				this.producer.cacheVideoSequenceBuffer = Buffer.from(body);

				for (const id in this.consumers) {
					this.consumers[id].startPlay();
				}
			}
		} else if (avc_packet_type == 1) {
			const sendHeader = {
				chunkStreamId: 4,
				timestamp: header.timestamp,
				messageTypeId: 0x09,
				messageStreamId: 1
			};
			const message = this.createMessage(sendHeader, body);

			for (const id in this.consumers) {
				this.consumers[id].sendBufferQueue.push(message);
			}
		}
	}

	public sendStreamEOF(): void {
		const buffer = Buffer.from("020000000000060400000000000100000001", "hex");
		this.socket.write(buffer);
	}

	public sendMessage(self): void {
		if (!self.isStarting) return;
		const len = self.sendBufferQueue.length;

		for (let i = 0; i < len; i++) {
			self.socket.write(self.sendBufferQueue.shift());
		}

		setTimeout(self.sendMessage, 100, self);
	}
}
