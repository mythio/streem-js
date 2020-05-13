import { EventEmitter } from "events";

import { generateS0S1S2 } from "./handshake";
import BufferPool from "../core/bufferPool";
import amf from "./amf0";
import { log } from "../config/logger";

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
	sendBufferQueue: Buffer[];

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
		this.bp._read = () => {
			return;
		};
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

	public run(): void {
		this.isStarting = true;
		this.bp.init(this.parser);
	}

	public stop(): void {
		this.isStarting = false;
		if (this.publishStreamName != "") {
			// delete producers
		} else if (this.playStreamName != "") {
			// delete consumer
		}

		delete this.conns[this.id];

		this.emit("stop");
	}

	private getRealChunkSize(bodySize: number, chunkSize: number) {
		const length = bodySize + Math.floor(bodySize / chunkSize);
		if (bodySize % chunkSize) {
			return length;
		} else {
			return length - 1;
		}
	}

	private createRtmpMessage(header, body) {
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

	private handleRtmpMessage(header, body: Buffer) {
		switch (header.messageTypeID) {
			case 0x01:
				this.inChunkSize = body.readUInt32BE(0);
				break;
			case 0x04:
				// @TODO: logs ping and client id
				break;
			case 0x08:
				this.parseAudioMessage(header, body);
				break;
			case 0x09:
				// this.parseVideoMessage(header, body);
				break;
			case 0x0f:
				// @TODO AMF0 Data
				break;
			case 0x11:
				// @TODO AMF0 Command
				break;
			case 0x12:
				// @TODO AMF0 Data
				break;
			case 0x14:
				// @TODO AMF0 Command
				break;
		}
	}

	private handleAmfCommandMessage(cmd: any) {
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
				this.closeStream();
				break;
			case "deleteStream":
				this.deleteStream();
				break;
			case "pause":
				this.pauseOrUnpauseStream();
				break;
			case "releaseStream":
				this.respondReleaseStream();
				break;
			case "FCPublish":
				this.respondFCPublish();
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
				this.respondFCUnpublish();
				break;
			default:
				return;
		}
	}

	private startPlay() {
		const producer = this.producers[this.playStreamName];
		if (
			!producer.metadata ||
			!producer.cacheAudioSequenceBuffer ||
			!producer.cacheAudioSequenceBuffer
		)
			return;

		const opt = {
			cmd: "onMetaData",
			cmdObj: producer.metaData
		};

		const body = amf.encode(opt);
		const metadataMessage = this.createRtmpMessage(
			{
				chunkStreamId: 5,
				timestamp: 0,
				messageTypeId: 0x12,
				messageStreamId: 1
			},
			body
		);

		const audioSequenceMessage = this.createRtmpMessage(
			{
				chunkStreamID: 4,
				timestamp: 0,
				messageTypeID: 0x08,
				messageStreamID: 1
			},
			producer.cacheAudioSequenceBuffer
		);

		const videoSequenceMessage = this.createRtmpMessage(
			{
				chunkStreamID: 4,
				timestamp: 0,
				messageTypeID: 0x09,
				messageStreamID: 1
			},
			producer.cacheVideoSequenceBuffer
		);

		const beginRtmpMessage = new Buffer("020000000000060400000000000000000001", "hex");
		this.sendBufferQueue.push(beginRtmpMessage);
		this.sendBufferQueue.push(metadataMessage);
		this.sendBufferQueue.push(audioSequenceMessage);
		this.sendBufferQueue.push(videoSequenceMessage);
		this.sendRtmpMessage(this);
	}

	private sendRtmpMessage(self: this): void {
		if (!self.isStarting) return;
		const length = self.sendBufferQueue.length;
		for (let i = 0; i < length; i++) {
			self.socket.write(self.sendBufferQueue.shift());
		}
		setTimeout(self.sendRtmpMessage, 100, self);
	}

	private parseAudioMessage(header, body: Buffer): void {
		// Found this code only for aac codec ;_;
		console.log(header);
		if (this.isFirstAudioReceived) {
			const aacPacketType = body[1];
			if (aacPacketType == 0) {
				this.codec.aacProfile = body[2];
				this.codec.aacSampleRate = body[3];

				this.codec.aacChannels = (this.codec.aacSampleRate >> 3) & 0x0f;
				this.codec.aacSampleRate =
					((this.codec.aacProfile << 1) & 0x0e) | ((this.codec.aacSampleRate >> 7) & 0x01);
				this.codec.aacProfile = (this.codec.aacProfile >> 3) & 0x1f;
				this.codec.audioSampleRate = aacSampleRates[this.codec.aacSampleRate];
				if (this.codec.aacProfile == 0 || this.codec.aacProfile == 0x1f) {
					this.emit(
						"error",
						new Error(
							"Parse audio aac sequence header failed," +
								` adts object=${this.codec.aacProfile} invalid`
						)
					);
				}
				--this.codec.aacProfile;
				this.isFirstAudioReceived = false;
				this.producer.cacheAudioSequenceBuffer = new Buffer(rtmpBody);

				for (const id in this.consumers) {
					this.consumers[id].startPlay();
				}
			} else {
				const sendRtmpHeader = {
					chunkStreamID: 4,
					timestamp: header.timestamp,
					messageTypeID: 0x08,
					messageStreamID: 1
				};
				const rtmpMessage = this.createRtmpMessage(sendRtmpHeader, rtmpBody);

				for (const id in this.consumers) {
					this.consumers[id].sendBufferQueue.push(rtmpMessage);
				}
			}
		}
	}
}
