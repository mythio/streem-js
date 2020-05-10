/* eslint-disable @typescript-eslint/no-var-requires */
const path = require("path");
const merge = require("webpack-merge");
const nodeExternals = require("webpack-node-externals");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");

const common = require("./webpack.common.js");

module.exports = merge(common, {
	devtool: "source-map",
	entry: [path.join(__dirname, "src/index.ts")],
	externals: [nodeExternals({})],
	mode: "production",
	plugins: [new CleanWebpackPlugin()]
});
