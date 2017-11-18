"use strict";

const Resas = require("../service/resas");
const resas = new Resas(process.env.RESAS_API_KEY);
const debug = require("debug")("bot-express:skill");
const db = require("../service/db");

module.exports = class SkillShowEstateDetail {
    constructor(){
        this.required_parameter = {
            interested: {
                message_to_confirm: {
                    type: "template",
                    altText: "こちらの物件、チェックしますか？（はい・いいえ）",
                    template: {
                        type: "confirm",
                        text: "こちらの物件、チェックしますか？",
                        actions: [
                            {type:"message", label:"はい", text:"はい"},
                            {type:"message", label:"いいえ", text:"いいえ"}
                        ]
                    }
                },
                parser: (value, bot, event, context, resolve, reject) => {
                    if (value == "はい"){
                        return resolve(true);
                    } else if (value == "いいえ"){
                        return resolve(false);
                    }
                    return reject();
                }
            }
        }
    }

    begin(bot, event, context, resolve, reject){
        if (event.type != "beacon" || !event.beacon || event.beacon.type != "enter" || !event.beacon.hwid){
            return resolve();
        }
        context.confirmed.hwid = event.beacon.hwid;
        return resolve();
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

        return db.get_estate(context.confirmed.hwid).then((response) => {
            context.confirmed.estate = response;

            let tasks = [];

            tasks.push(resas.get_estate_transaction({
                year: 2015,
                prefCode: context.confirmed.estate.pref_code,
                cityCode: context.confirmed.estate.city_code,
                displayType: 1
            }));

            return Promise.all(tasks);
        }).then((response) => {
            let transaction = response[0].result.years[0];
            let messages = [];
            messages.push({
                type: "text",
                text: `こちらの物件、価格は${context.confirmed.estate.price}万円、面積は${context.confirmed.estate.area}平米になります。ちなみにこのあたりの平均不動産取引価格は平米あたり${transaction.value}です。`
            });
            messages.push({
                type: "template",
                altText: "さらに詳しい物件情報を見る場合はこちらを参照ください。",
                template: {
                    type: "buttons",
                    text: "さらに詳しい物件情報を見る場合はこちらを参照ください。",
                    actions: [
                        {type:"web_url", label:"詳細情報", url:context.confirmed.estate.brocher_url}
                    ]
                }
            });
            return bot.reply(messages);
        }).then((response) => {
            return resolve();
        });
    }
}
