import Server from "./server";
import { logger } from "./config/logger";
import { config } from "./config/config";

const server = new Server();

server.on("error", (err) => {
	throw err;
});

server.on("client", (connection) => {
	connection.on("connect", () => {
		logger.info(`CONNECT: ${connection.app}`);
	});

	connection.on("play", ({ streamName }) => {
		logger.info(`PLAY: ${streamName}`);
	});

	connection.on("publish", ({ streamName }) => {
		logger.info(`PUBLISH: ${streamName}`);
	});

	connection.on("stop", () => {
		logger.info(`DISCONNECTED`);
	});
});

server.listen(config.PORT);

if ((module as any).hot) {
	(module as any).hot.accept();
	(module as any).hot.dispose(() => server.close());
}
