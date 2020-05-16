/* eslint-disable @typescript-eslint/no-var-requires */
const path = require("path");

module.exports = {
	module: {
		rules: [
			{
				exclude: /node_modules/,
				test: /\.ts$/,
				use: "ts-loader"
			}
		]
	},
	output: {
		filename: "index.js",
		path: path.resolve(__dirname, "dist")
	},
	resolve: {
		extensions: [".ts", ".js"]
	},
	target: "node"
};
