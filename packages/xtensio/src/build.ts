import { getXtensioWebpackConfig } from "./config/webpack.config";
import webpack from "webpack";

export default async function buildCommand(cwd: string) {
  const webpackConfig = await getXtensioWebpackConfig(cwd, false);
  webpack(webpackConfig, (err, stats) => {
    if (err) {
      console.log(err);
    } else {
      console.log(stats?.toString({colors: true}))
      console.log("Extension bundled for production!");
    }
  });
}
