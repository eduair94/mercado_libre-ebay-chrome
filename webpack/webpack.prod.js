const common = require("./webpack.common.js");

module.exports = (env, argv) => {
  // Check if the build is in development mode
  return {
    ...common, // Spread operator to merge the common configuration
    mode: "production", // Default to 'production' if mode is not specified
    // You can add more development-specific configurations here
  };
};
