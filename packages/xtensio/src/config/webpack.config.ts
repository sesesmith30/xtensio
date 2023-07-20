import { rmSync } from "fs";
import fs from "fs/promises";
import HtmlWebpackPlugin from "html-webpack-plugin";
import { exec } from "node:child_process";
import path from "path";
import webpack from "webpack";
import WebpackExtensionManifestPlugin from "webpack-extension-manifest-plugin";
import { ContentConfig } from "../../types";
import { directoryExists, fileExists } from "../helper";
import "./environment";

function execute(cmd: string) {
  return new Promise<void>((resolve, reject) => {
    exec(cmd, {}, (error, stdout, stderr) => {
      if (error) reject(error);
      resolve();
    });
  });
}

const getTmpDir = (cwd: string) => {
  return path.join(cwd, "./.xtensio/tmp");
};

async function compileManifestTS(mPath: string, cwd: string) {
  await execute(
    `yarn tsc ${mPath} --outDir ${getTmpDir(
      cwd
    )} --resolveJsonModule --esModuleInterop --jsx react --allowUmdGlobalAccess`
  );
  const relPath = path.relative(cwd, mPath);
  const extName = path.extname(mPath);
  const possiblePaths = [
    path.join(getTmpDir(cwd), path.basename(mPath).replace(extName, ".js")),
    path.join(getTmpDir(cwd), relPath.replace(extName, ".js")),
  ];
  const activePath = possiblePaths.find((p) => fileExists(p));
  return activePath as string;
}

function clearTmpDir(cwd: string) {
  // clear tmpdir if it exists
  if (directoryExists(getTmpDir(cwd)))
    rmSync(getTmpDir(cwd), { force: true, recursive: true });
}

export const getXtensioWebpackConfig = async (cwd: string) => {
  clearTmpDir(cwd);
  const popup = path.join(cwd, "./popup/popup.tsx");
  const isPopup = fileExists(popup);
  const background = path.join(cwd, "./background/index.ts");
  const isBackground = fileExists(background);
  const manifest = path.join(cwd, "./manifest.ts");

  const baseManifest = await compileManifestTS(manifest, cwd);
  const importObj = await import(baseManifest);
  const manifestObj = importObj?.default || importObj;

  const popupManifest = isPopup
    ? { action: { default_popup: "popup.html" } }
    : {};
  const backgroudManifest = isBackground
    ? { background: { service_worker: "background.js" } }
    : {};

  const reactMountLoader = path.resolve(
    __dirname,
    "../loaders/reactMountLoader.js"
  );
  const importReactLoader = path.resolve(
    __dirname,
    "../loaders/importReactLoader.js"
  );
  const babelLoader = {
    loader: "babel-loader",
    options: {
      presets: [
        "@babel/preset-env",
        "@babel/preset-react",
        "@babel/preset-typescript",
      ],
    },
  };

  const contentsDir = path.join(cwd, "./contents");
  const isContents = directoryExists(contentsDir);
  const contentFiles = isContents
    ? await fs.readdir(path.join(cwd, "./contents"))
    : [];
  const contentFilesAndExt = await Promise.all(
    contentFiles.map(async (file) => {
      const contentLoc = path.join(contentsDir, file);
      const compiled = await compileManifestTS(contentLoc, cwd);
      const codeImport = await import(compiled);
      const defaultExport = codeImport?.default || codeImport || {};
      const config: ContentConfig = {
        matches: defaultExport.matches,
        shadowRoot: defaultExport.shadowRoot,
        component: defaultExport.component?.name || defaultExport.component,
      };
      const ext = path.extname(file);
      return {
        filename: path.basename(file, ext),
        ext,
        config,
      };
    })
  );

  const contentNamesAndPaths = contentFilesAndExt
    .filter((file) => !!file.config.matches?.length)
    .map((file) => ({
      [file.filename]: path.join(cwd, `./contents/${file.filename}${file.ext}`),
    }));
  // TODO based on the ext value and shadowRoot & component value in ContentConfig - put in the right loader RegExp
  const contentsEntry = Object.assign({}, ...contentNamesAndPaths) as Record<
    string,
    string
  >;

  const contentsManifest = contentFilesAndExt
    .filter((file) => !!file.config.matches?.length)
    .map((file) => ({
      matches: file.config.matches,
      js: [file.filename + ".js"],
    }));

  clearTmpDir(cwd);
  return {
    mode: "development",
    devtool: "inline-source-map",
    entry: {
      ...(isPopup ? { popup } : {}),
      ...(isBackground ? { background } : {}),
      // TODO go through everything in pages folder.
      // get the default export supposed to be a react component
      // inject code that create the react mount and renders the component
      // now use new file for webpack here!
      ...contentsEntry,
    },
    output: {
      path: path.join(cwd, "./.xtensio/dist"),
      filename: "[name].js",
    },
    module: {
      rules: [
        {
          test: new RegExp(path.basename(popup)),
          exclude: "/node_modules/",
          use: [
            babelLoader,
            {
              loader: reactMountLoader,
            },
          ],
        },
        {
          test: /\.(js|jsx|ts|tsx)$/,
          include: /\/contents\//,
          exclude: /node_modules/,
          use: [
            babelLoader,
            {
              loader: importReactLoader,
            },
          ],
        },
        {
          test: /\.(js|jsx|ts|tsx)$/,
          exclude: "/node_modules/",
          use: babelLoader,
        },
        {
          test: /\.(css|scss|sass)$/,
          use: ["style-loader", "css-loader", "sass-loader"],
        },
      ],
    },
    resolve: {
      extensions: [".ts", ".tsx", ".js", ".jsx"],
    },
    plugins: [
      new WebpackExtensionManifestPlugin({
        config: {
          base: {
            ...manifestObj,
            ...popupManifest,
            ...backgroudManifest,
            content_scripts: contentsManifest,
          },
        },
      }),
      new HtmlWebpackPlugin({
        chunks: ["popup"],
        filename: "popup.html",
      }),
    ],
  } as webpack.Configuration;
};