import { Socket } from "net";

import * as utils from "../core/utils";
import RTMP from "../constant/rtmp";
import { ctx } from "../core/context";

export class RtmpSession {
	private config;
	private res;
	private socket;
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
}
