import path from "node:path";
import url from "node:url";
import alias from "@rollup/plugin-alias";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import resolve from "@rollup/plugin-node-resolve";
import { swc } from "rollup-plugin-swc3";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const uuid = "com.fcannizzaro.hoyodeck";
const isWatching = !!process.env.ROLLUP_WATCH;
const sdPlugin = `${uuid}.sdPlugin`;

export default {
  input: "src/plugin.ts",
  output: {
    file: `${sdPlugin}/bin/plugin.js`,
    format: "cjs",
    sourcemap: true,
    sourcemapPathTransform: (relativeSourcePath, sourcemapPath) => {
      return url.pathToFileURL(
        path.resolve(path.dirname(sourcemapPath), relativeSourcePath),
      ).href;
    },
  },
  external: [],
  plugins: [
    alias({
      entries: [
        { find: /^@\/(.*)/, replacement: path.resolve(__dirname, "src/$1") },
      ],
    }),
    swc({
      minify: !isWatching,
      sourceMaps: isWatching,
      jsc: {
        parser: {
          decorators: true,
        },
      },
    }),
    json(),
    resolve({
      browser: false,
      exportConditions: ["node"],
      preferBuiltins: true,
    }),
    commonjs(),
    {
      name: "emit-module-package-file",
      generateBundle() {
        this.emitFile({
          fileName: "package.json",
          source: JSON.stringify({
            main: "plugin.js",
          }),
          type: "asset",
        });
      },
    },
  ],
};
