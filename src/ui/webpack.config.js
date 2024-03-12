/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyPlugin = require("copy-webpack-plugin");
const path = require("path");

module.exports = (env) => {
    console.log("T200 UI", env);
    console.log("T200 UI cwd", __dirname);
    const plugins = [
        new HtmlWebpackPlugin({
            template: path.join(__dirname, "src", "index.html"),
        }),
        new CopyPlugin({
            patterns: [
                { from: "./src/assets/", to: "assets/" },
            ]
        })
    ];

    return {
        plugins,
        resolve: {
            extensions: [".js", ".jsx", ".ts", ".tsx"]
        },
        entry: path.resolve(__dirname, "src", "index.tsx"),
        output: {
            path: path.resolve(__dirname, "dist"),
            publicPath: "/",
            filename: "[name].js",
            clean: true
        },
        devServer: {
            static: {
                directory: path.resolve(__dirname, "src/assets")
            },
            open: false,
            historyApiFallback: true,
            client: {
                logging: "info",
                overlay: {
                    errors: true,
                    warnings: false
                }
            },
            port: 3030,
            hot: true,
            onListening: function (devServer) {
                if (!devServer) {
                    throw new Error("webpack-dev-server is not defined");
                }

                const port = devServer.server.address().port;
                console.log("Listening on port:", port);
            }
        },
        module: {
            rules: [
                {
                    test: /\.(ts|tsx)$/,
                    include: [path.resolve(__dirname, "src"), path.resolve(__dirname, "..", "common")],
                    exclude: /node_modules/,
                    use: [
                        {
                            loader: "babel-loader",
                            options: {
                                presets: [
                                    [
                                        "@babel/preset-env",
                                        {
                                            targets: "defaults"
                                        }
                                    ],
                                    "@babel/preset-react",
                                    "@babel/preset-typescript"
                                ]
                            }
                        }
                    ]
                },
                {
                    test: /\.styles.ts$/,
                    exclude: /node_modules/,
                    use: {
                        loader: '@griffel/webpack-loader',
                        options: {
                            babelOptions: {
                                presets: ['@babel/preset-typescript'],
                            },
                        },
                    },
                },
                {
                    test: /\.css$/,
                    use: ["style-loader", "css-loader"]
                },
                {
                    test: /\.(png|svg|jpg|jpeg|gif)$/i,
                    type: "asset/resource"
                },
                {
                    test: /\.(woff|woff2|eot|ttf|otf)$/i,
                    type: "asset/resource"
                }
            ]
        }
    };
};