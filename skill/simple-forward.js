"use strict";

const debug = require("debug")("bot-express:skill");
const db = require("../service/kozu-db");
const app_env = require("../environment_variables");
const BOT_ID = app_env.BOT_ID;
Promise = require("bluebird");

/*
** Just forward the original message to Admin User
** Supported messenger is LINE Only.
** Supported message types are text, sticker and location.
*/
const SUPPORTED_MESSENGERS = ["line"];
const SUPPORTED_MESSAGE_TYPES = ["text", "sticker", "location"];
const IMMEDIATE_REPLY = process.env.SIMPLE_FORWARD_IMMEDIATE_REPLY;

module.exports = class SkillSimpleForward {
    constructor(messenger, event){
        this.clear_context_on_finish = true;
    }

    finish(bot, event, context, resolve, reject){
        if (!SUPPORTED_MESSENGERS.includes(bot.type)){
            // We do nothing in case of facebook since in Facebook, Admin can see and reply the messege by Facebook Page.
            debug(`${event.message.type} messenger is not supported in simple-forward skill. Supported messenger is LINE only. We just skip processing this event.`);
            return resolve();
        }

        if (!SUPPORTED_MESSAGE_TYPES.includes(event.message.type)){
            debug(`${event.message.type} message type is not supported in simple-forward skill. Supported message types are text and sticker message type. We just skip processing this event.`);
            return resolve();
        }

        let tasks = [];

        // Reply to sender.
        if (IMMEDIATE_REPLY === "enable"){
            const IMMEDIATE_REPLY_MESSAGE = [{
                type: "text",
                text: "ちょっとまってくださいね。今詳しい人に聞いてきますので。"
            },{
                type: "text",
                text: "すぐ調べます。ちょっとお待ちを。"
            }];
            let offset = Math.floor(Math.random() * (IMMEDIATE_REPLY_MESSAGE.length));
            tasks.push(bot.reply(IMMEDIATE_REPLY_MESSAGE[offset]));
        }

        // Send message to admin.
        let interval = 500;
        let admin_user_id_list = [];
        tasks.push(
            Promise.resolve()
            .then((response) => {
                // Get admin list.
                return db.get_admin_list();
            })
            .then((response) => {
                // Save admin list.
                debug(`There are ${response.length} admins to escalate.`);
                if (response.length === 0){
                    return Promise.reject(new Error(`There is no admin.`));
                }

                for (let admin of response){
                    admin_user_id_list.push(admin.user_id);
                }

                // Get user's displayName.
                return bot.plugin.line.sdk.getProfile(bot.extract_sender_id());
            })
            .then((response) => {
                let message = {
                    type: "text",
                    text: `${response.displayName}さんからいただいた次のメッセージがわかりませんでした。`
                };

                // Send 1st message to admin.
                debug(admin_user_id_list);
                return bot.multicast(admin_user_id_list, message);
            })
            .delay(interval).then((response) => {
                // Send original message.
                let message = JSON.parse(JSON.stringify(event.message));
                delete message.id;
                return bot.multicast(admin_user_id_list, message);
            })
            .delay(interval).then((response) => {
                // Send action message.
                let message = {
                    type: "template",
                    altText: `さて、どうしますか？`,
                    template: {
                        type: "buttons",
                        text: `さて、どうしますか？`,
                        actions: [
                            {type: "postback", label: "ユーザーに返信する", data: `次のユーザーに返信してください。 ${bot.extract_sender_id()}`},
                            {type: "postback", label: "Botに学習させる", data: `${bot.extract_sender_id()} からの次の表現をインテントに追加してください。 ${bot.extract_message_text()}`}
                        ]
                    }
                }
                return bot.multicast(admin_user_id_list, message);
            })
        );

        return Promise.all(tasks).then((response) => {
            return resolve();
        });
    }
};
