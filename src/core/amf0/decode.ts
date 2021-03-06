/**
 * /// <reference path="https://github.com/delian/node-amfutils/blob/master/amfUtils.js" />
 */

import { rtmpCmd } from "./cmd";

type decodeData = {
	length: number;
	value: any;
};

const decodeOne = (buffer: Buffer): decodeData => {
	if (!decodeRules[buffer.readUInt8(0)]) {
		throw new Error("Error: Unknown field");
	}
	return decodeRules[buffer.readUInt8(0)](buffer);
};

const decodeUString = (buf: Buffer): decodeData => {
	const length = buf.readUInt16BE(0) + 2;
	return {
		length,
		value: buf.toString("utf8", 2, length)
	};
};

const markSArray = (obj: any): any => {
	Object.defineProperty(obj, "sarray", {
		value: true
	});
	return obj;
};

const decNumber = (buf: Buffer): decodeData => {
	return { length: 9, value: buf.readDoubleBE(1) };
};

const decBool = (buf: Buffer): decodeData => {
	return { length: 2, value: buf.readUInt8(1) != 0 };
};

const decString = (buf: Buffer): decodeData => {
	const length = buf.readUInt16BE(1) + 3;
	return {
		length,
		value: buf.toString("utf8", 3, length)
	};
};

const decObject = (buf: Buffer): decodeData => {
	const obj = {};
	let iBuf = buf.slice(1);
	let length = 1;

	while (iBuf.readUInt8(0) != 0x09) {
		const prop = decodeUString(iBuf);
		length += prop.length;
		if (iBuf.slice(prop.length).readUInt8(0) == 0x09) {
			++length;
			break;
		}

		if (prop.value == "") break;

		const value = decodeOne(iBuf.slice(prop.length));
		obj[prop.value] = value.value;
		length += value.length;
		iBuf = iBuf.slice(prop.length + value.length);
	}

	return { length, value: obj };
};

const decNull = (): decodeData => {
	return {
		length: 1,
		value: null
	};
};

const decUndefined = (): decodeData => {
	return {
		length: 1,
		value: undefined
	};
};

const decRef = (buf: Buffer): decodeData => {
	const index = buf.readUInt16BE(1);
	return {
		length: 3,
		value: "ref" + index
	};
};

const decArray = (buf): decodeData => {
	const obj = decObject(buf.slice(4));
	return {
		length: 5 + obj.length,
		value: obj.value
	};
};

const decSArray = (buf: Buffer): decodeData => {
	const arr = [];
	let length = 5;
	let ret: any;
	for (let count = buf.readUInt32BE(1); count; count--) {
		ret = decodeOne(buf.slice(length));
		arr.push(ret.value);
		length += ret.length;
	}
	return {
		length,
		value: markSArray(arr)
	};
};

const decDate = (buf: Buffer): decodeData => {
	const timestamp = buf.readDoubleBE(3);
	return {
		length: 11,
		value: timestamp
	};
};

const decLongString = (buf: Buffer): decodeData => {
	const length = buf.readUInt32BE(1) + 5;
	return {
		length,
		value: buf.toString("utf8", 5, length)
	};
};

const decXmlDoc = (buf: Buffer): decodeData => {
	const length = buf.readUInt16BE(1) + 3;
	return {
		length,
		value: buf.toString("utf8", 3, length)
	};
};

const decTypedObj = (buf: Buffer): decodeData => {
	const className = decString(buf);
	const obj = decObject(buf.slice(className.length - 1));
	obj.value.__className__ = className.value;
	return {
		length: className.length + obj.length - 1,
		value: obj.value
	};
};

const decodeRules = {
	0x00: decNumber,
	0x01: decBool,
	0x02: decString,
	0x03: decObject,
	// 0x04 Reserved, don't know why
	0x05: decNull,
	0x06: decUndefined,
	0x07: decRef,
	0x08: decArray,
	// 0x09 Not reachable
	0x0a: decSArray,
	0x0b: decDate,
	0x0c: decLongString,
	// 0x0D Not implemented in the specs
	// 0x0E Not implemented in the specs
	0x0f: decXmlDoc,
	0x10: decTypedObj
};

export const decodeAmf0Cmd = (dbuf: Buffer): any => {
	let buf = dbuf;
	const resp: any = {};

	const cmd = decodeOne(buf);
	resp.cmd = cmd.value;
	buf = buf.slice(cmd.length);

	if (rtmpCmd[cmd.value]) {
		rtmpCmd[cmd.value].forEach((key: string) => {
			if (buf.length > 0) {
				const res = decodeOne(buf);
				buf = buf.slice(res.length);
				resp[key] = res.value;
			}
		});
	}
	return resp;
};
