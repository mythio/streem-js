import Server from "./server";
const server = new Server();

server.on("error", (err) => {
	throw err;
});

server.on("client", (client) => {
	client.on("connect", () => {
		console.log("CONNECT", client.app);
	});

	client.on("play", ({ streamName }) => {
		console.log("PLAY", streamName);
	});

	client.on("publish", ({ streamName }) => {
		console.log("PUBLISH", streamName);
	});

	client.on("stop", () => {
		console.log("DISCONNECT");
	});
});

server.listen(1935);
