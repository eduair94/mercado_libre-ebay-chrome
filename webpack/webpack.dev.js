const common = require("./webpack.common.js");

module.exports = (env, argv) => {
  // Check if the build is in development mode
  return {
    ...common, // Spread operator to merge the common configuration
    devtool: "inline-source-map", // Use inline-source-map only in development
    mode: "development", // Default to 'production' if mode is not specified
    // You can add more development-specific configurations here
  };
};
