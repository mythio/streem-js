/**
 * /// <reference path="https://github.com/delian/node-amfutils/blob/master/amfUtils.js" />
 */

import { rtmpCmd } from "./cmd";

const amfType = (obj: any): string => {
	const jsType = typeof obj;

	if (obj === null) return "null";
	if (jsType == "undefined") return "undefined";
	if (jsType == "number") {
		if (parseInt(obj) == obj) return "integer";
		return "double";
	}
	if (jsType == "boolean") return obj ? "true" : "false";
	if (jsType == "string") return "string";
	if (jsType == "object") {
		if (obj instanceof Array) {
			if ((obj as any).sarray) return "sarray";
			return "array";
		}
		return "object";
	}
	throw new Error("Unsupported type!");
};

const encodeOne = (obj: any): Buffer => {
	const encodeWith = encodeRules[amfType(obj)];
	// console.log(encodeWith);
	if (!encodeWith) throw new Error("Unsupported type for encoding!");
	return encodeWith(obj);
};

const encodeUString = (str: string): Buffer => {
	const data = new Buffer(str, "utf8");
	const length = new Buffer(2);
	length.writeUInt16BE(data.length, 0);
	return Buffer.concat([length, data]);
};

const encString = (str: string): Buffer => {
	const buf = new Buffer(3);
	buf.writeUInt8(0x02, 0);
	buf.writeUInt16BE(str.length, 1);
	return Buffer.concat([buf, new Buffer(str, "utf8")]);
};

const encNumber = (num: number): Buffer => {
	const buf = new Buffer(9);
	buf.writeUInt8(0x00, 0);
	buf.writeDoubleBE(num, 1);
	return buf;
};

const encXmlDoc = (str: string): Buffer => {
	const buf = new Buffer(3);
	buf.writeUInt8(0x0f, 0);
	buf.writeUInt16BE(str.length, 1);
	return Buffer.concat([buf, new Buffer(str, "utf8")]);
};

const encObject = (obj: any): Buffer => {
	if (typeof obj !== "object") return;

	let data = new Buffer(1);
	data.writeUInt8(0x03, 0); // Type object
	let k;
	for (k in obj) {
		data = Buffer.concat([data, encodeUString(k), encodeOne(obj[k])]);
	}
	const termCode = new Buffer(1);
	termCode.writeUInt8(0x09, 0);
	return Buffer.concat([data, encodeUString(""), termCode]);
};

const encArray = (arr: any[]): Buffer => {
	let length = 0;
	if (arr instanceof Array) length = arr.length;
	else length = Object.keys(arr).length;
	const buf = new Buffer(5);
	buf.writeUInt8(8, 0);
	buf.writeUInt32BE(length, 1);
	const data = encObject(arr);
	return Buffer.concat([buf, data.slice(1)]);
};

const encSArray = (a: any[]): Buffer => {
	let buf = new Buffer(5);
	buf.writeUInt8(0x0a, 0);
	buf.writeUInt32BE(a.length, 1);
	for (let i = 0; i < a.length; i++) {
		buf = Buffer.concat([buf, encodeOne(a[i])]);
	}
	return buf;
};

const encBool = (flag: number): Buffer => {
	const buf = new Buffer(2);
	buf.writeUInt8(0x01, 0);
	buf.writeUInt8(flag ? 1 : 0, 1);
	return buf;
};

const encUndefined = (): Buffer => {
	const buf = new Buffer(1);
	buf.writeUInt8(0x06, 0);
	return buf;
};

const encNull = (): Buffer => {
	const buf = new Buffer(1);
	buf.writeUInt8(0x05);
	return buf;
};

const encodeRules = {
	string: encString,
	integer: encNumber,
	double: encNumber,
	xml: encXmlDoc,
	object: encObject,
	array: encArray,
	sarray: encSArray,
	binary: encString,
	true: encBool,
	false: encBool,
	undefined: encUndefined,
	null: encNull
};

export const encodeAmf0Cmd = (opt: any): Buffer => {
	let data = encodeOne(opt.cmd);

	if (rtmpCmd[opt.cmd]) {
		rtmpCmd[opt.cmd].forEach((n) => {
			if (opt.hasOwnProperty(n)) data = Buffer.concat([data, encodeOne(opt[n])]);
		});
	}
	return data;
};
