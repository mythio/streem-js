import { Readable } from "stream";
import Connection from "../rtmp/connection";

export default class BufferPool extends Readable {
	private totalBufferLength: number;
	private needBufferLength: number;
	private gFun: any;

	constructor(options) {
		super(options);
	}

	init(gFun: Generator<Connection>): void {
		this.totalBufferLength = 0;
		this.needBufferLength = 0;
		this.gFun = gFun;
		this.gFun.next();
	}

	push(buf: Buffer): boolean {
		this.totalBufferLength += buf.length;
		if (this.needBufferLength > 0 && this.needBufferLength <= this.totalBufferLength)
			this.gFun.next();
		return super.push(buf);
	}

	read(size: number): any {
		this.totalBufferLength -= size;
		return super.read(size);
	}

	need(size: number): boolean {
		const ret = this.totalBufferLength < size;
		if (ret) {
			this.needBufferLength = size;
		}
		return ret;
	}
}
