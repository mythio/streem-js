/* eslint-disable @typescript-eslint/no-var-requires */
const path = require("path");
const webpack = require("webpack");
const merge = require("webpack-merge");
const nodeExternals = require("webpack-node-externals");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");

const common = require("./webpack.common.js");

module.exports = merge.smart(common, {
	devtool: "#source-map",
	entry: ["webpack/hot/poll?1000", path.join(__dirname, "src/index.ts")],
	externals: [
		nodeExternals({
			whitelist: ["webpack/hot/poll?1000"]
		})
	],
	mode: "development",
	plugins: [new CleanWebpackPlugin(), new webpack.HotModuleReplacementPlugin()],
	watch: true
});
