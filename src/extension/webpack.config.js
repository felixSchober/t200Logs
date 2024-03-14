/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

"use strict";

const path = require("path");

const CopyPlugin = require("copy-webpack-plugin");
const WatchExternalFilesPlugin = require("webpack-watch-files-plugin").default;


module.exports = (env) => {
    console.log("T200 EXTENSION", env);
    console.log("T200 EXTENSION cwd", __dirname);

    const uiDistPath = path.resolve(__dirname, "..", "ui", "dist");
    console.log("T200 EXTENSION uiDistPath", uiDistPath);

    const mediaPath = path.resolve(__dirname, "media", "sidePanelReact");
    console.log("T200 EXTENSION mediaPath", mediaPath);

    const isProduction = env.production === true;
    const sourceMaps = isProduction ? undefined : "inline-source-map";


    return {
        plugins: [
            new CopyPlugin({
                patterns: [
                    { from: uiDistPath, to: mediaPath },
                ]
            }),
            new WatchExternalFilesPlugin({
                verbose: true,
                files: [
                    `${uiDistPath}/**/*.js`,
                    `${uiDistPath}/**/*.html`,
                ]
            })
        ],
        context: path.resolve(__dirname, "..", "extension"), // to automatically find tsconfig.json
        target: "node", // VS Code extensions run in a Node.js-context 📖 -> https://webpack.js.org/configuration/node/
        mode: "none", // this leaves the source code as close as possible to the original (when packaging we set this to 'production')

        entry: path.resolve(__dirname, "src", "extension.ts"), // the entry point of this extension, 📖 -> https://webpack.js.org/configuration/entry-context/
        output: {
            // the bundle is stored in the 'dist' folder (check package.json), 📖 -> https://webpack.js.org/configuration/output/
            path: path.resolve(__dirname, "dist"),
            filename: "extension.js",
            libraryTarget: "commonjs2",
            clean: true
        },
        externals: {
            vscode: "commonjs vscode" // the vscode-module is created on-the-fly and must be excluded. Add other modules that cannot be webpack'ed, 📖 -> https://webpack.js.org/configuration/externals/
            // modules added here also need to be added in the .vscodeignore file
        },
        resolve: {
            // support reading TypeScript and JavaScript files, 📖 -> https://github.com/TypeStrong/ts-loader
            extensions: [".ts", ".js"]
        },
        module: {
            rules: [
                {
                    test: /\.ts$/,
                    exclude: /node_modules/,
                    use: [
                        {
                            loader: "ts-loader"
                        }
                    ]
                }
            ]
        },
        devtool: sourceMaps,
        infrastructureLogging: {
            level: "log", // enables logging required for problem matchers
        },
    };
};