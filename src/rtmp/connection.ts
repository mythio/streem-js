/* eslint-disable @typescript-eslint/camelcase */
import { EventEmitter } from "events";

import BufferPool from "../core/bufferPool";
import amf from "./amf0";
import { log } from "../config/logger";
import { parseRtmpMessage } from "../core/utils";
import { AAC_SAMPLE_RATES } from "../constant/aac";

export default class Connection extends EventEmitter {
	id: any;
	socket: any;
	conns: any;
	consumers: Connection;
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
	// codec: {
	// 	aacProfile?;
	// 	aacSampleRate?;
	// 	aacChannels?;
	// 	avcProfile?;
	// 	avcLevel?;
	// 	nalUnitLength?;
	// 	width: number;
	// 	height: number;
	// 	duration: number;
	// 	frameRate: number;
	// 	videoDataRate: number;
	// 	audioSampleRate: number;
	// 	audioSampleSize: number;
	// 	audioDataRate: number;
	// 	spsLen: number;
	// 	sps: any;
	// 	ppsLen: number;
	// 	pps: any;
	// };
	codec: any;
	sendBufferQueue: Buffer[];
	producer: any;
	app: any;
	objectEncoding: any;

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
		this.bp._read = (): void => {
			// console.log(1);
			const a = 1;
		};
		this.bp.on("error", () => {
			const a = 1;
		});

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

	public run(): void {
		this.isStarting = true;
		this.bp.init(this.parser);
	}

	public stop(): void {
		this.isStarting = false;
		if (this.publishStreamName != "") {
			for (const id in this.consumers) {
				this.consumers[id].sendStreamEOF();
			}
			delete this.producers[this.publishStreamName];
		} else if (this.playStreamName != "") {
			if (this.producers[this.playStreamName]) {
				delete this.producers[this.playStreamName].consumers[this.id];
			}
		}

		delete this.conns[this.id];
		this.emit("stop");
	}

	public getRealChunkSize(bodySize: number, chunkSize: number): number {
		const length = bodySize + Math.floor(bodySize / chunkSize);
		if (bodySize % chunkSize) {
			return length;
		} else {
			return length - 1;
		}
	}

	private createMessage(header, body): Buffer {
		const formatId = 0;
		let bodySize = body.length;

		// console.log(header);
		if (header.chunkStreamId == null)
			log("WARN", `createRtmpMessage(): chunkStreamId is not set for RTMP`);
		if (header.timestamp == null)
			log("WARN", `createRtmpMessage(): timestamp is not set for RTMP message`);
		if (header.messageTypeId == null)
			log("WARN", `createRtmpMessage(): messageTypeId is not set for RTMP message`);
		if (header.messageStreamId == null)
			log("WARN", `createRtmpMessage(): messageStreamId is not set for RTMP message`);

		let useExtendedTimestamp = false;
		let timestamp: number[];

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
			(formatId << 6) | header.chunkStreamId,
			timestamp[0],
			timestamp[1],
			timestamp[2],
			(bodySize >> 16) & 0xff,
			(bodySize >> 8) & 0xff,
			bodySize & 0xff,
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
			if (bodySize > this.outChunkSize) {
				chunkBody.push(body.slice(bodyPos, bodyPos + this.outChunkSize));
				bodySize -= this.outChunkSize;
				bodyPos += this.outChunkSize;
				chunkBody.push(type3Header);
			} else {
				chunkBody.push(body.slice(bodyPos, bodyPos + bodySize));
				bodySize -= bodySize;
				bodyPos += bodySize;
			}
		} while (bodySize > 0);

		const chunkBodyBuffer = Buffer.concat(chunkBody);
		buffer = Buffer.concat([buffer, chunkBodyBuffer]);

		return buffer;
	}

	public handleMessage(header, body: Buffer): void {
		switch (header.messageTypeId) {
			case 0x01:
				this.inChunkSize = body.readUInt32BE(0);
				break;
			case 0x04:
				break;
			case 0x08:
				this.parseAudioMessage(header, body);
				break;
			case 0x09:
				this.parseVideoMessage(header, body);
				break;
			case 0x0f: {
				const cmd = amf.decode(body.slice(1));
				this.receiveSetDataFrame(cmd.method, cmd.cmdObj);
				break;
			}
			case 0x11: {
				const cmd = amf.decode(body.slice(1));
				this.handleAmfCommandMessage(cmd);
				break;
			}
			case 0x12: {
				const cmd = amf.decode(body);
				this.receiveSetDataFrame(cmd.method, cmd.cmdObj);
				break;
			}
			case 0x14: {
				const cmd = amf.decode(body);
				this.handleAmfCommandMessage(cmd);
				break;
			}
		}
	}

	private handleAmfCommandMessage(cmd: any): void {
		this.emit("command", cmd);

		switch (cmd.cmd) {
			case "connect": {
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
			case "createStream":
				this.respondCreateStream(cmd);
				break;
			case "play": {
				const streamName = this.connectCmdObj.app + "/" + cmd.streamName;
				this.playStreamName = streamName;

				this.emit("play", cmd);
				this.respondPlay();

				if (!this.producers[streamName]) {
					this.producers[streamName] = {
						id: null,
						consumers: {}
					};
				}

				this.producers[streamName].consumers[this.id] = this;
				this.startPlay();
				break;
			}
			case "closeStream":
				// this.closeStream();
				break;
			case "deleteStream":
				// this.deleteStream();
				break;
			case "pause":
				// this.pauseOrUnpauseStream();
				break;
			case "releaseStream":
				// this.respondReleaseStream();
				break;
			case "FCPublish":
				// this.respondFCPublish();
				break;
			case "publish": {
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
			case "FCUnpublish":
				// this.respondFCUnpublish();
				break;
			default:
				return;
		}
	}

	private windowACK(size: number): void {
		const buffer = new Buffer("02000000000004050000000000000000", "hex");
		buffer.writeUInt32BE(size, 12);
		this.socket.write(buffer);
	}

	private setPeerBandwidth(size: number, type: number): void {
		const buffer = new Buffer("0200000000000506000000000000000000", "hex");
		buffer.writeUInt32BE(size, 12);
		buffer[16] = type;
		this.socket.write(buffer);
	}

	private setChunkSize(size): void {
		const buffer = new Buffer("02000000000004010000000000000000", "hex");
		buffer.writeUInt32BE(size, 12);
		this.socket.write(buffer);
	}

	private respondConnect(): void {
		const body = amf.encode({
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
		});
		const message = this.createMessage(
			{
				chunkStreamId: 3,
				timestamp: 0,
				messageTypeId: 0x14,
				messageStreamId: 0
			},
			body
		);
		this.socket.write(message);
	}

	private respondCreateStream(cmd: any): void {
		const body = amf.encode({
			cmd: "_result",
			transId: cmd.transId,
			cmdObj: null,
			info: 1
		});
		const message = this.createMessage(
			{
				chunkStreamId: 3,
				timestamp: 0,
				messageTypeId: 0x14,
				messageStreamId: 0
			},
			body
		);
		this.socket.write(message);
	}

	private respondPlay(): void {
		let body = amf.encode({
			cmd: "onStatus",
			transId: 0,
			cmdObj: null,
			info: {
				level: "status",
				code: "NetStream.Play.Start",
				description: "Start live"
			}
		});
		let message = this.createMessage(
			{
				chunkStreamId: 3,
				timestamp: 0,
				messageTypeId: 0x14,
				messageStreamId: 1
			},
			body
		);
		this.socket.write(message);

		const opt = {
			cmd: "|RtmpSampleAccess",
			bool1: true,
			bool2: true
		};

		body = amf.encode(opt);
		message = this.createMessage(
			{
				chunkStreamId: 5,
				timestamp: 0,
				messageTypeId: 0x12,
				messageStreamId: 1
			},
			body
		);
		this.socket.write(message);
	}

	private startPlay(): void {
		const producer = this.producers[this.playStreamName];
		if (
			producer.metadata == null ||
			producer.cacheAudioSequenceBuffer == null ||
			producer.cacheAudioSequenceBuffer == null
		)
			return;

		const body = amf.encode({
			cmd: "onMetaData",
			cmdObj: producer.metaData
		});
		const metadataMessage = this.createMessage(
			{
				chunkStreamId: 5,
				timestamp: 0,
				messageTypeId: 0x12,
				messageStreamId: 1
			},
			body
		);

		const audioSequenceMessage = this.createMessage(
			{
				chunkStreamId: 4,
				timestamp: 0,
				messageTypeId: 0x08,
				messageStreamId: 1
			},
			producer.cacheAudioSequenceBuffer
		);

		const videoSequenceMessage = this.createMessage(
			{
				chunkStreamId: 4,
				timestamp: 0,
				messageTypeId: 0x09,
				messageStreamId: 1
			},
			producer.cacheVideoSequenceBuffer
		);

		const beginRtmpMessage = new Buffer("020000000000060400000000000000000001", "hex");
		this.sendBufferQueue.push(beginRtmpMessage);
		this.sendBufferQueue.push(metadataMessage);
		this.sendBufferQueue.push(audioSequenceMessage);
		this.sendBufferQueue.push(videoSequenceMessage);
		this.sendMessage(this);
	}

	private respondPublish(): void {
		const body = amf.encode({
			cmd: "onStatus",
			transId: 0,
			cmdObj: null,
			info: {
				level: "status",
				code: "NetStream.Publish.Start",
				description: "Start publishing"
			}
		});
		const message = this.createMessage(
			{
				chunkStreamId: 5,
				timestamp: 0,
				messageTypeId: 0x14,
				messageStreamId: 1
			},
			body
		);
		this.socket.write(message);
	}

	private respondPublishError(): void {
		const body = amf.encode({
			cmd: "onStatus",
			transId: 0,
			cmdObj: null,
			info: {
				level: "error",
				code: "NetStream.Publish.BadName",
				description: "Already publishing"
			}
		});
		const message = this.createMessage(
			{
				chunkStreamId: 5,
				timestamp: 0,
				messageTypeId: 0x14,
				messageStreamId: 1
			},
			body
		);
		this.socket.write(message);
	}

	private receiveSetDataFrame(method: string, obj: any): void {
		if (method == "onMetaData") {
			this.producers[this.publishStreamName].metaData = obj;
		}
	}

	private parseAudioMessage(header, body: Buffer): void {
		// Found this code only for aac codec ;_;
		if (this.isFirstAudioReceived) {
			let sound_format = body[0];
			sound_format = (sound_format >> 4) & 0x0f;
			if (sound_format != 10) {
				this.emit("error", new Error(`Only support audio aac codec. actual=${sound_format}`));
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
					this.emit(
						"error",
						new Error(
							"Parse audio aac sequence header failed," +
								` adts object=${this.codec.aac_profile} invalid`
						)
					);
					return;
				}
				this.codec.aac_profile--;
				this.isFirstAudioReceived = false;
				this.producer.cacheAudioSequenceBuffer = new Buffer(body);

				for (const id in this.consumers) {
					this.consumers[id].startPlay();
				}
			}
		} else {
			const sendRtmpHeader = {
				chunkStreamId: 4,
				timestamp: header.timestamp,
				messageTypeId: 0x08,
				messageStreamId: 1
			};
			const rtmpMessage = this.createMessage(sendRtmpHeader, body);

			for (const id in this.consumers) {
				this.consumers[id].sendBufferQueue.push(rtmpMessage);
			}
		}
	}

	private parseVideoMessage(header, body): void {
		let index = 0;
		let frame_type = body[0];
		const codec_id = frame_type & 0x0f;
		frame_type = (frame_type >> 4) & 0x0f;
		// only support h.264/avc
		if (codec_id != 7) {
			this.emit("error", new Error(`Only support video h.264/avc codec. actual=${codec_id}`));
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

				let numOfSequenceParameterSets = body[10];
				numOfSequenceParameterSets &= 0x1f;

				if (numOfSequenceParameterSets != 1) {
					this.emit("error", new Error("Decode video avc sequenc header sps failed"));
					return;
				}

				this.codec.spsLen = body.readUInt16BE(11);

				index = 11 + 2;
				if (this.codec.spsLen > 0) {
					this.codec.sps = new Buffer(this.codec.spsLen);
					body.copy(this.codec.sps, 0, 13, 13 + this.codec.spsLen);
				}

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
					this.codec.pps = new Buffer(this.codec.ppsLen);
					body.copy(this.codec.pps, 0, index, index + this.codec.ppsLen);
				}
				this.isFirstVideoReceived = false;

				this.producer.cacheVideoSequenceBuffer = new Buffer(body);
				for (const id in this.consumers) {
					this.consumers[id].startPlay();
				}
			}
		} else if (avc_packet_type == 1) {
			const sendRtmpHeader = {
				chunkStreamId: 4,
				timestamp: header.timestamp,
				messageTypeId: 0x09,
				messageStreamId: 1
			};
			const rtmpMessage = this.createMessage(sendRtmpHeader, body);

			for (const id in this.consumers) {
				this.consumers[id].sendBufferQueue.push(rtmpMessage);
			}
		}
	}

	public sendStreamEOF(): void {
		const buffer = new Buffer("020000000000060400000000000100000001", "hex");
		this.socket.write(buffer);
	}

	private sendMessage(self): void {
		if (!self.isStarting) return;
		const len = self.sendBufferQueue.length;
		for (let i = 0; i < len; i++) {
			self.socket.write(self.sendBufferQueue.shift());
		}
		setTimeout(self.sendMessage, 100, self);
	}
}
