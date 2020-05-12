const HANDSHAKE = {
	SIZE: 1536,
	UNINIT: 0,
	_0: 1,
	_1: 2,
	_2: 3
};

const PARSE = {
	INIT: 0,
	BASIC_HEADER: 1,
	MESSAGE_HEADER: 2,
	EXTENDED_TIMESTAMP: 3,
	PAYLOAD: 4
};

const CHUNK_TYPE = {
	_0: 0, // 11B: timestamp(3) + length(3) + stream_type(1) + stream_id(4)
	_1: 1, //  7B: delta(3) + length(3) + stream_type(1)
	_2: 2, //  3B: delta(3)
	_3: 3 //   0B
};

const CHANNEL = {
	PROTOCOL: 2,
	INVOKE: 3,
	AUDIO: 4,
	VIDEO: 5,
	DATA: 6
};

const TYPE = {
	// Protocol control message
	SET_CHUNK_SIZE: 1,
	ABORT: 2,
	ACKNOWLEDGEMENT: 3, //             Bytes read acknowlege
	WINDOW_ACKNOWLEDGEMENT_SIZE: 5, // Server bandwidth
	SET_PEER_BANDWIDTH: 6, //          Client bandwidth
	// User control message event
	EVENT: 4,
	AUDIO: 8,
	VIDEO: 9,
	// Data message
	FLEX_STREAM: 15, // AMF3
	DATA: 18, //        AMF0
	// Command message
	FLEX_MESSAGE: 17, // AMF3
	INVOKE: 20, //       AMF0
	// Aggregate meesage
	METADATA: 22
};

const STREAM = {
	BEGIN: 0x00,
	EOF: 0x01,
	DRY: 0x02,
	EMPTY: 0x1f,
	READY: 0x20
};

const RTMP = {
	HANDSHAKE,
	PARSE,
	MAX_CHUNK_HEADER: 18,
	CHUNK_TYPE,
	CHANNEL,
	HEADER_SIZE: [11, 7, 3, 0],
	TYPE,
	CHUNK_SIZE: 128,
	PING_TIME: 60000,
	PING_TIMEOUT: 30000,
	STREAM
};

export default RTMP;
