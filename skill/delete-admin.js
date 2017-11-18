"use strict";

const debug = require("debug")("bot-express:skill");
const db = require("../service/kozu-db");
const app_env = require("../environment_variables");
Promise = require("bluebird");

module.exports = class SkillDeleteAdmin {
    finish(bot, event, context, resolve, reject){
        return db.delete_admin(bot.extract_sender_id()).then(
            (response) => {
                return bot.reply({
                    type: "text",
                    text: "お疲れ様でした。"
                });
            }
        ).then(
            (response) => {
                return resolve();
            }
        );
    }
}
