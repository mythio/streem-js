import { Readable } from "stream";
import Connection from "../rtmp/connection";

export default class BufferPool extends Readable {
	private totalBufferLength: number;
	private needBufferLength: number;
	private generatorFun: Generator<Connection>;

	constructor(options?: object) {
		console.log(options);
		super(options);
	}

	public init(generatorFun: Generator<Connection>): void {
		this.totalBufferLength = 0;
		this.needBufferLength = 0;
		this.generatorFun = generatorFun;
		this.generatorFun.next();
	}

	public push(buf: Buffer): boolean {
		super.push(buf);
		this.totalBufferLength += buf.length;
		if (this.needBufferLength > 0 && this.needBufferLength <= this.totalBufferLength)
			this.generatorFun.next();

		return true;
	}

	public read(size: number): Buffer {
		this.totalBufferLength -= size;

		return super.read(size);
	}

	public need(size: number): boolean {
		const isAvail = this.totalBufferLength < size;
		if (isAvail) {
			this.needBufferLength = size;
		}

		return isAvail;
	}
}
