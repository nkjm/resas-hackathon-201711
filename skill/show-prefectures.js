"use strict";

const Resas = require("../service/resas");
const resas = new Resas(process.env.RESAS_API_KEY);

module.exports = class SkillShowPrefecture {
    constructor(){
        this.clear_context_on_finish = true;
    }

    finish(bot, event, context, resolve, reject){
        return resas.get_prefectures().then((response) => {
            let text = "";
            for (let pref of response.result){
                text += pref.prefName + ",";
            }
            return bot.reply({
                type: "text",
                text: text + "です。"
            });
        }).then((response) => {
            return resolve();
        });
    }
}
