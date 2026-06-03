const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const sharedRoot = path.resolve(projectRoot, "packages/shared");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [sharedRoot];

config.resolver.extraNodeModules = {
  "@pos/shared": sharedRoot,
};

module.exports = config;
