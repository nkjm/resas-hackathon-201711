"use strict";

const Resas = require("../service/resas");
const db = require("../service/db");
const resas = new Resas(process.env.RESAS_API_KEY);
const debug = require("debug")("bot-express:skill");

module.exports = class SkillGuide {
    constructor(){
        this.clear_context_on_finish = true;
    }

    finish(bot, event, context, resolve, reject){
        if (event.type != "beacon" || !event.beacon || event.beacon.type != "enter" || !event.beacon.hwid){
            return resolve();
        }

        return db.get_guide(event.beacon.hwid).then((response) => {
            return bot.reply({
                type: "text",
                text: response.message
            });
        }).then((response) => {
            return resolve();
        });
    }
}
