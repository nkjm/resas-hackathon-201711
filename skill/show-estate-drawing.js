"use strict";

require('dotenv').config();
const Resas = require("../service/resas");
const resas = new Resas(process.env.RESAS_API_KEY);
const debug = require("debug")("bot-express:skill");
const db = require("../service/db");

module.exports = class SkillShowEstateDrawing {
    constructor(){
        this.required_parameter = {
            estate: {
                message_to_confirm: { // dummy.
                    type: "text",
                    text: "どの物件ですか？"
                }
            }
        }
    }

    finish(bot, event, context, resolve, reject){
        let messages = [{
            type: "text",
            text: "こちらになります。"
        },{
            type: "image",
            originalContentUrl: context.confirmed.estate.drawing_orig_url,
            previewImageUrl: context.confirmed.estate.drawing_prev_url
        }];

        return bot.reply(messages).then((response) => {
            return resolve();
        });
    }
}
