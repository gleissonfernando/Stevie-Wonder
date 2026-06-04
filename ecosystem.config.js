module.exports = {
  apps: [
    {
      name: "steve-wonder",
      script: "scripts/start-dashboard.cjs",
      watch: false,
      env: {
        NODE_ENV: "production",
        PORT: "80",
        START_DISCORD_BOT: "false"
      }
    }
  ]
};
