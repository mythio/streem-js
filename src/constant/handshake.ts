const MESSAGE_FORMAT = {
	_0: 0,
	_1: 1,
	_2: 2
};

const HANDSHAKE = {
	MESSAGE_FORMAT,
	RTMP_SIG_SIZE: 1536,
	SHA256DL: 32 // SHA 256B digest length
};

export default HANDSHAKE;
