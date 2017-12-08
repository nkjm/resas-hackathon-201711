"use strict";

/*
** Import Packages
*/
require('dotenv').config();
const server = require("express")();
const bot_express = require("bot-express");

/*
** Middleware Configuration
*/
server.listen(process.env.PORT || 5000, () => {
    console.log(`server is listening to ${process.env.PORT || 5000}...`);
});

/*
** Mount bot-express
*/
server.use("/webhook", bot_express({
    nlu: {
        language: "ja",
        options: {
            client_access_token: process.env.DIALOGFLOW_CLIENT_ACCESS_TOKEN
        }
    },
    memory: {
        type: "memory-cache",
        retention: Number(process.env.MEMORY_RETENTION)
    },
    line_channel_secret: process.env.LINE_CHANNEL_SECRET,
    line_access_token: process.env.LINE_ACCESS_TOKEN,
    google_project_id: process.env.GOOGLE_PROJECT_ID,
    auto_translation: process.env.AUTO_TRANSLATION,
    beacon_skill: {
        enter: "show-estate-detail"
    },
    default_skill: process.env.DEFAULT_SKILL
}));

module.exports = server;
