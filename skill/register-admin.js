"use strict";

const debug = require("debug")("bot-express:skill");
const db = require("../service/kozu-db");
const app_env = require("../environment_variables");
Promise = require("bluebird");

module.exports = class SkillRegisterAdmin {
    constructor(){
        this.required_parameter = {
            question: {
                message_to_confirm: {
                    type: "template",
                    altText: "では問題です。このBotを作った開発者の趣味はなんでしょうか？",
                    template: {
                        type: "buttons",
                        text: "では問題です。このBotを作った開発者の趣味はなんでしょうか？",
                        actions: [
                            {type: "message", label: "フライフィッシング", text: "フライフィッシング"},
                            {type: "message", label: "銭湯", text: "銭湯"},
                            {type: "message", label: "子育て", text: "子育て"},
                            {type: "message", label: "相撲観戦", text: "相撲観戦"}
                        ]
                    }
                },
                reaction: (error, value, bot, event, context, resolve, reject) => {
                    if (error){
                        return resolve();
                    }
                    let message_text;
                    context.confirmed.is_correct = false;
                    if (value === "キャンプ"){
                        message_text = "おめでとうございます。今日からあなたは管理者です。";
                        context.confirmed.is_correct = true;
                    } else if (value == "料理"){
                        message_text = "ブッブーーー。確かに料理はしますが趣味ってほどじゃないんですよねー。";
                    } else if (value === "フライフィッシング"){
                        message_text = "ブッブーーー。釣りなんかしたことないもんねー。";
                    } else if (value === "子育て"){
                        message_text = "ブッブーーー。そんな調子乗ったら奥さんに殺されるわ。";
                    } else if (value === "銭湯"){
                        message_text = "ブッブーーー。銭湯ってそもそも趣味？。";
                    } else if (value === "鉄道写真"){
                        message_text = "ブッブーーー。私がテッちゃん？なわけないですよ。";
                    } else if (value === "相撲観戦"){
                        message_text = "ブッブーーー。相撲観戦？全く興味なし。";
                    }
                    bot.queue({
                        type: "text",
                        text: message_text
                    });
                    return resolve();
                }
            }
        },
        this.clear_context_on_finish = true;
    }

    finish(bot, event, context, resolve, reject){
        if (context.confirmed.is_correct){
            let admin = {
                user_id: bot.extract_sender_id(),
                messenger: bot.type
            }

            return bot.plugin.line.sdk.getProfile(bot.extract_sender_id()).then(
                (response) => {
                    debug(response);
                    admin.name = response.displayName;
                    return db.create_admin(admin);
                }
            ).then(
                (response) => {
                    return bot.reply();
                }
            ).then(
                (response) => {
                    return resolve();
                }
            )
        } else {
            return bot.reply().then(
                (response) => {
                    return resolve();
                }
            )
        }
    }
}
