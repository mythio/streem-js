import { Socket } from "net";

import * as utils from "../core/utils";
import RTMP from "../constant/rtmp";
import { ctx } from "../core/context";
import { log } from "../config/logger";
import { generateS0S1S2 } from "./handshake";

export class RtmpSession {
	private config;
	private res;
	private socket: Socket;
	private id;
	private ip;
	private TAG;
	private handshakePayload;
	private handshakeState;
	private handshakeBytes;
	private parseBuffer;
	private parserState;
	private parserBytes;
	private parserBasicBytes;
	private parserPacket;
	private inPackets;
	private inChunkSize;
	private outChunkSize;
	private pingTime;
	private pingTimeout;
	private pingInterval;
	private isLocal;
	private isStarting;
	private isPublishing;
	private isPlaying;
	private isIdling;
	private isPause;
	private isReceiveAudio;
	private isReceiveVideo;
	private metaData;
	private aacSequenceHeader;
	private avcSequenceHeader;
	private audioCodec;
	private audioCodecName;
	private audioProfileName;
	private audioSamplerate;
	private audioChannels;
	private videoCodec;
	private videoCodecName;
	private videoProfileName;
	private videoWidth;
	private videoHeight;
	private videoFps;
	private videoLevel;
	private gopCacheEnable;
	private rtmpGopCacheQueue;
	private flvGopCacheQueue;
	private ackSize;
	private inAckSize;
	private inLastAck;
	private appname;
	private streams;
	private playStreamId;
	private playStreamPath;
	private playArgs;
	private publishStreamId;
	private publishStreamPath;
	private publishArgs;
	private players;
	private numPlayCache;

	constructor(config, socket: Socket) {
		this.config = config;
		this.res = this.socket = socket;
		this.id = utils.generateSessionId();
		this.ip = socket.remoteAddress;
		this.TAG = "rtmp";

		this.handshakePayload = Buffer.alloc(RTMP.HANDSHAKE.SIZE);
		this.handshakeState = RTMP.HANDSHAKE.UNINIT;
		this.handshakeBytes = 0;

		this.parseBuffer = Buffer.alloc(RTMP.MAX_CHUNK_HEADER);
		this.parserState = RTMP.PARSE.INIT;
		this.parserBytes = 0;
		this.parserBasicBytes = 0;
		this.parserPacket = null;
		this.inPackets = new Map();

		this.inChunkSize = RTMP.CHUNK_SIZE;
		this.outChunkSize = config.rtmp.chunk_size ? config.rtmp.chunk_size : RTMP.CHUNK_SIZE;
		this.pingTime = config.rtmp.ping ? config.rtmp.ping * 1000 : RTMP.PING_TIME;
		this.pingTimeout = config.rtmp.ping_timeout
			? config.rtmp.ping_timeout * 1000
			: RTMP.PING_TIMEOUT;
		this.pingInterval = null;

		this.isLocal = this.ip === "127.0.0.1" || this.ip === "::1" || this.ip == "::ffff:127.0.0.1"; // localhost
		this.isStarting = false;
		this.isPublishing = false;
		this.isPlaying = false;
		this.isIdling = false;
		this.isPause = false;
		this.isReceiveAudio = true;
		this.isReceiveVideo = true;
		this.metaData = null;
		this.aacSequenceHeader = null;
		this.avcSequenceHeader = null;
		this.audioCodec = 0;
		this.audioCodecName = "";
		this.audioProfileName = "";
		this.audioSamplerate = 0;
		this.audioChannels = 1;
		this.videoCodec = 0;
		this.videoCodecName = "";
		this.videoProfileName = "";
		this.videoWidth = 0;
		this.videoHeight = 0;
		this.videoFps = 0;
		this.videoLevel = 0;

		this.gopCacheEnable = config.rtmp.gop_cache;
		this.rtmpGopCacheQueue = null;
		this.flvGopCacheQueue = null;

		this.ackSize = 0;
		this.inAckSize = 0;
		this.inLastAck = 0;

		this.appname = "";
		this.streams = 0;

		this.playStreamId = 0;
		this.playStreamPath = "";
		this.playArgs = {};

		this.publishStreamId = 0;
		this.publishStreamPath = "";
		this.publishArgs = {};

		this.players = new Set();
		this.numPlayCache = 0;
		ctx.sessions.set(this.id, this);
	}

	public run(): void {
		this.socket.on("data", this.onSocketData.bind(this));
		this.socket.on("close", this.onSocketClose.bind(this));
		this.socket.on("error", this.onSocketError.bind(this));
		this.socket.on("timeout", this.onSocketTimeout.bind(this));
		this.socket.setTimeout(this.pingTimeout);
		this.isStarting = true;
	}

	public stop(): void {
		if (this.isStarting) this.isStarting = false;

		if (this.playStreamId > 0) this.onDeleteStream({ streamId: this.playStreamId });

		if (this.publishStreamId > 0) this.onDeleteStream({ streamId: this.publishStreamId });

		if (this.pingInterval != null) {
			clearInterval(this.pingInterval);
			this.pingInterval = null;
		}

		log("INFO", `[rtmp dissconnect] id=${this.id}`);
		ctx.nodeEvent.emit("donConnect", this.id, this.connectCmdObj);

		ctx.sessions.delete(this.id);
		this.socket.destroy();
	}

	public reject(): void {
		log("INFO", `[rtmp reject] id=${this.id}`);
		this.stop();
	}

	public flush(): void {
		if (this.numPlayCache > 0) this.res.uncork();
	}

	private onSocketClose(): void {
		this.stop();
	}

	private onSocketError(err): void {
		this.stop(err);
	}

	private onSocketTimeout() {
		this.stop();
	}

	private onSocketData(data: Buffer) {
		let bytes = data.length();
		let start = 0;
		let len = 0;
		while (bytes > 0) {
			switch (this.handshakeState) {
				case RTMP.HANDSHAKE.UNINIT:
					this.handshakeState = RTMP.HANDSHAKE._0;
					this.handshakeBytes = 0;
					bytes -= 1;
					start += 1;
					break;
				case RTMP.HANDSHAKE._0:
					len = RTMP.HANDSHAKE.SIZE - this.handshakeBytes;
					len = len <= bytes ? len : bytes;
					data.copy(this.handshakePayload, this.handshakeBytes, start, start + len);
					this.handshakeBytes += len;
					bytes -= len;
					start += len;
					if (this.handshakeBytes === RTMP.HANDSHAKE.SIZE) {
						this.handshakeState = RTMP.HANDSHAKE._1;
						this.handshakeBytes = 0;
						this.socket.write(generateS0S1S2(this.handshakePayload));
					}
					break;
				case RTMP.HANDSHAKE._1:
					len = RTMP.HANDSHAKE.SIZE - this.handshakeBytes;
					len = len <= bytes ? len : bytes;
					data.copy(this.handshakePayload, this.handshakeBytes, p, len);
					this.handshakeBytes += len;
					bytes -= len;
					p += len;
					if (this.handshakeBytes === RTMP_HANDSHAKE_SIZE) {
						this.handshakeState = RTMP_HANDSHAKE_2;
						this.handshakeBytes = 0;
						this.handshakePayload = null;
					}
					break;
				case RTMP.HANDSHAKE._2:
				default:
					return this.rtmpChunkRead(data, start, bytes);
			}
		}
	}

	private rtmpChunkBasicHeaderCreate(fmt, cid) {
		let out;
		if (cid >= 64 + 255) {
			out = Buffer.alloc(3);
			out[0] = (fmt << 6) | 1;
			out[1] = (cid - 64) & 0xff;
			out[2] = ((cid - 64) >> 8) & 0xff;
		} else if (cid >= 64) {
			out = Buffer.alloc(2);
			out[0] = (fmt << 6) | 0;
			out[1] = (cid - 64) & 0xff;
		} else {
			out = Buffer.alloc(1);
			out[0] = (fmt << 6) | cid;
		}
		return out;
	}
}
