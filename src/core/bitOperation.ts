/**
 * /// <reference path="https://github.com/illuspas/bitop.js/blob/master/bitop.js" />
 */

export class BitOperation {
	private buffer: Buffer;
	private bufferLength: number;
	private bufferPosition: number;
	private bufferOffset: number;
	private isError: boolean;

	constructor(buffer: Buffer) {
		this.buffer = buffer;
		this.bufferLength = buffer.length;
		this.bufferPosition = 0;
		this.bufferOffset = 0;
		this.isError = false;
	}

	private read(n: number): number {
		let v = 0;
		let d = 0;
		while (n) {
			if (n < 0 || this.bufferPosition >= this.bufferLength) {
				this.isError = true;
				return 0;
			}

			this.isError = false;
			d = this.bufferOffset + n > 8 ? 8 - this.bufferOffset : n;

			v <<= d;
			v += (this.buffer[this.bufferPosition] >> (8 - this.bufferOffset - d)) & (0xff >> (8 - d));
			this.bufferOffset += d;
			n -= d;

			if (this.bufferOffset == 8) {
				this.bufferPosition++;
				this.bufferOffset = 0;
			}
		}
		return v;
	}

	public look(n: number): number {
		const pos = this.bufferPosition;
		const off = this.bufferOffset;
		const value = this.read(n);
		this.bufferPosition = pos;
		this.bufferOffset = off;
		return value;
	}

	public readGolomb(): number {
		let n = 0;
		for (; this.read(1) == 0 && !this.isError; ++n);
		return (1 << n) + this.read(n) - 1; // @TODO: Why -1?
	}
}
