"use strict";

const Resas = require("../service/resas");
const resas = new Resas(process.env.RESAS_API_KEY);
const debug = require("debug")("bot-express:skill");
const db = require("../service/db");

module.exports = class SkillShowEstateDetail {
    constructor(){
        this.required_parameter = {
            interested: {
                message_to_confirm: {},
                parser: (value, bot, event, context, resolve, reject) => {
                    if (value == "はい"){
                        return resolve(true);
                    } else if (value == "いいえ"){
                        return resolve(false);
                    }
                    return reject();
                },
                reaction: (error, value, bot, event, context, resolve, reject) => {
                    if (error){
                        return resolve();
                    }
                    if (value === true){
                        return db.save_log({
                            estate_id: context.confirmed.estate.id,
                            user_id: bot.extract_sender_id(),
                            type: "interested"
                        }).then((response) => {
                            return resolve();
                        });
                    }
                    return resolve();
                }
            }
        }
    }

    begin(bot, event, context, resolve, reject){
        /*
        if (event.type != "beacon" || !event.beacon || event.beacon.type != "enter" || !event.beacon.hwid){
            return resolve();
        }
        context.confirmed.hwid = event.beacon.hwid;
        */

        let tasks = [];
        context.confirmed.hwid = '010b5fb92a';
        return db.get_estate(context.confirmed.hwid).then((response) => {
            context.confirmed.estate = response;
            bot.change_message_to_confirm("interested", {
                type: "template",
                altText: `今見てらっしゃる${context.confirmed.estate.name}の物件、ご案内しますか？（はい・いいえ）`,
                template: {
                    type: "confirm",
                    text: `今見てらっしゃる${context.confirmed.estate.name}の物件、ご案内しましょうか？`,
                    actions: [
                        {type:"message", label:"はい", text:"はい"},
                        {type:"message", label:"いいえ", text:"いいえ"}
                    ]
                }
            });
            return db.save_log({
                estate_id: context.confirmed.estate.id,
                user_id: bot.extract_sender_id(),
                type: "beacon"
            });
        }).then((response) => {
            return resolve();
        });
    }

    finish(bot, event, context, resolve, reject){
        if (!context.confirmed.interested){
            return bot.reply({
                type: "text",
                text: "クソが。"
            }).then((response) => {
                return resolve();
            });
        }


        let tasks = [];

        tasks.push(resas.get_estate_transaction({
            year: 2015,
            prefCode: context.confirmed.estate.pref_code,
            cityCode: context.confirmed.estate.city_code,
            displayType: 1
        }));

        Promise.all(tasks).then((response) => {
            let transaction = response[0].result.years[0];
            let messages = [];

            let avg_value = Math.floor(transaction.value / 10000 * context.confirmed.estate.area);
            debug("avg_value is " + avg_value);

            let message_text = `こちらの物件、敷地面積は${context.confirmed.estate.area}平米、価格は${context.confirmed.estate.price}万円になります。\n\nちなみにこのあたりの平均不動産取引価格は平米あたり${Math.floor(transaction.value / 10000)}万円ですから、相場から見ると`;
            if (context.confirmed.estate.price > avg_value){
                if (context.confirmed.estate.price - 300 > avg_value){
                    message_text += `かなり高いですね。`;
                } else {
                    message_text += `ちょっと高いですね。`;
                }
            } else if (context.confirmed.estate.price < avg_value){
                if (context.confirmed.estate.price + 300 < avg_value){
                    message_text += `かなり安いですね。`;
                } else {
                    message_text += `ちょっと安いですね。`;
                }
            } else {
                message_text += `ちょうど平均価格ですね。`;
            }

            messages.push({
                type: "text",
                text: message_text
            });

            return bot.reply(messages);
        }).then((response) => {
            return resolve();
        });
    }
}
