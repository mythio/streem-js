import crypto from "crypto";
import { log } from "../config/logger";
import { generateS0S1S2 } from "../rtmp/handshake";

// @TODO cleanup. Last try to decode golomb/rice
// Else stick to un-encrypted
// Who cares?

// export const generateSessionId = (): string => {
// 	return crypto.randomBytes(8).toString("hex");
// };

// export const generateName = (): string => {
// 	return crypto.randomBytes(4).toString("hex");
// };

// export const verify = (signString, streamId, secret): boolean => {
// 	if (!signString) return false;
// };

export function* parseRtmpMessage(self): void {
	log("INFO", "Handshake start");
	if (self.bp.need(1537)) yield;

	const c0c1 = self.bp.read(1537);
	const s0s1s2 = generateS0S1S2(c0c1);
	self.socket.write(s0s1s2);
	if (self.bp.need(1526)) yield;

	log("INFO", "Handshake Success");

	while (self.isStarting) {
		const message = {};
		let chunkMessageHeader: Buffer = null;
		const previousChunk = null;
		if (self.bp.need(1)) yield;

		const chunkBasicHeader = self.bp.read(1);
		message.formatType = chunkBasicHeader[0] >> 6;
		message.chunkStreamId = chunkBasicHeader[0] & 0x3f;
		if (message.chunkStreamId == 0) {
			if (self.bp.need(1)) yield;

			const exStreamId = self.bp.read(1);
			message.chunkStreamId = exStreamId[0] + 64;
		} else if (message.chunkStreamId == 1) {
			if (self.bp.need(2)) yield;

			const exStreamId = self.bp.read(2);
			message.chunkStreamId = (exStreamId[0] << 8) + exStreamId[1] + 64;
		}

		// incomplete. Page 3 ctd..
		switch (message.formatType) {
			case 0: {
				// 11B
				if (self.bp.need(11)) yield;

				chunkMessageHeader = self.bp.read(11);
				message.timestamp = chunkMessageHeader.readIntBE(0, 3);
				message.timestampDelta = 0;
				message.messageLength = chunkMessageHeader.readIntBE(3, 3);
				message.messageTypeID = chunkMessageHeader[6];
				message.messageStreamID = chunkMessageHeader.readInt32LE(7);

				break;
			}
			case 1: {
				// 7B
				if (self.bp.need(7)) yield;

				chunkMessageHeader = self.bp.read(7);
				message.timestampDelta = chunkMessageHeader.readIntBE(0, 3);
				message.messageLength = chunkMessageHeader.readIntBE(3, 3);
				message.messageTypeID = chunkMessageHeader[6];
				previousChunk = self.previousChunkMessage[message.chunkStreamID];

				if (!previousChunk) {
					log(
						"ERROR",
						`Type 1 chunk ref error\nPrevious chunk with id ${message.chunkStreamId} was not found`
					);
					throw new Error();
				}

				message.timestamp = previousChunk.timestamp;
				message.messageStreamID = previousChunk.messageStreamID;

				break;
			}
			case 2: {
				// 3B
				if (self.bp.need(3)) yield;

				chunkBasicHeader = self.bp.read(3);
				message.timestampDelta = chunkBasicHeader.readIntBE(0, 3);
				previousChunk = self.previousChunkMessage[message.chunkStreamId];

				if (!previousChunk) {
					log(
						"ERROR",
						`Type 2 chunk ref error\nPrevious chunk with id ${message.chunkStreamId} was not found`
					);
					throw new Error();
				}

				message.timestamp = previousChunk.timestamp;
				message.messageStreamID = previousChunk.messageStreamID;
				message.messageLength = previousChunk.messageLength;
				message.messageTypeID = previousChunk.messageTypeID;
				break;
			}
			case 3: {
				// 0B
				previousChunk = self.previousChunkMessage[message.chunkStreamID];

				if (!previousChunk) {
					log(
						"ERROR",
						`Type 3 chunk ref error\nPrevious chunk with id ${message.chunkStreamId} was not found`
					);
					throw new Error();
				}

				if (previousChunk != null) {
					message.timestamp = previousChunk.timestamp;
					message.messageStreamID = previousChunk.messageStreamId;
					message.messageLength = previousChunk.messageLength;
					message.timestampDelta = previousChunk.timestampDelta;
					message.messageTypeID = previousChunk.messageTypeID;
				}
			}
			case 4: {
				log("ERROR", "err");
				console.log(message.formatType);
				// @TODO: Fix this
			}
		}

		// handle extended timestamps
		if (message.formatType == 0) {
			if (message.timestamp == 0xffffff) {
				if (self.bp.need(4)) yield;

				const chunkBodyHeader = self.bp.read(4);

				// @TODO spec had cbh[0] * Math.pow(256, 3), why?
				message.timestamp =
					(chunkBodyHeader[0] << 24) +
					(chunkBodyHeader[1] << 16) +
					(chunkBodyHeader[2] << 8) +
					chunkBodyHeader[3];
			}
		} else {
			if (self.bp.need(4)) yield;

			const chunkBodyHeader = self.bp.read(4);
			message.timestampDelta =
				(chunkBodyHeader[0] << 24) +
				(chunkBodyHeader[1] << 16) +
				(chunkBodyHeader[2] << 8) +
				chunkBodyHeader[3];
		}
		console.log("ezio");
		console.log(message);
	}
}
