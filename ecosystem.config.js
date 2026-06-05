module.exports = {
  apps: [
    {
      name: "steve-wonder",
      script: "src/index.js",
      watch: false,
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
