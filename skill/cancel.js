"use strict";

const debug = require("debug")("bot-express:skill");

/*
** Just reply the text response provided from api.ai.
*/
module.exports = class SkillCancel {
    constructor(){
        this.clear_context_on_finish = true;
    }

    finish(bot, event, context, resolve, reject){
        debug(`Going to reply "${context.intent.text_response}".`);
        let message = {
            type: "text",
            text: context.intent.text_response
        };
        return bot.reply(message).then(
            (response) => {
                return resolve(response);
            }
        );
    }
};
