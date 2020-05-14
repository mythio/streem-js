import net from "net";
import crypto from "crypto";

import Connection from "./connection";

export default class Server extends net.Server {
	private conns: {};
	private producers: {};

	constructor(option?) {
		super(option);

		this.conns = {};
		this.producers = {};

		this.on("connection", (socket) => {
			const id = crypto.randomBytes(6).toString("hex");

			const connection = new Connection(id, socket, this.conns, this.producers as any);
			connection.attach();
			connection.on("error", (err) => socket.destroy(err));

			socket.on("data", (data) => connection.bp.push(data));
			socket.on("end", () => connection.stop());
			socket.on("error", (err) => connection.emit("error", err));

			this.emit("client", connection);
			connection.run();
		});
	}
}
