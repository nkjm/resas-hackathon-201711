"use strict";

const debug = require("debug")("bot-express:skill");
const admin_user_id = process.env.ADMIN_USER_ID;
const db = require("../service/db");
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

        if (context.confirmed.estate && event.type == "message" && event.message.type == "text"){
            // Save log
            tasks.push(
                Promise.resolve()
                .then((response) => {
                    return db.save_log({
                        estate_id: context.confirmed.estate.id,
                        user_id: bot.extract_sender_id(),
                        type: "question"
                    })
                })
            );

            // Save question
            tasks.push(
                Promise.resolve()
                .then((response) => {
                    return bot.plugin.line.sdk.getProfile(bot.extract_sender_id());
                }).then((response) => {
                    return db.save_question({
                        estate_id: context.confirmed.estate.id,
                        user_id: bot.extract_sender_id(),
                        user_display_name: response.displayName,
                        question: event.message.text
                    });
                })
            )
        }

        // Send message to admin.
        let interval = 500;
        tasks.push(
            Promise.resolve()
            .then((response) => {
                // Get user's displayName.
                return bot.plugin.line.sdk.getProfile(bot.extract_sender_id());
            })
            .then((response) => {
                let message;

                if (context.confirmed.estate && event.type == "message" && event.message.type == "text"){
                    message = {
                        type: "template",
                        altText: `${response.displayName}さんから${context.confirmed.estate.name}の物件について下記の質問をいただいています。`,
                        template: {
                            type: "buttons",
                            text: `${response.displayName}さんから${context.confirmed.estate.name}の物件について下記の質問をいただいています。`,
                            actions: [
                                {type: "uri", label: "物件詳細", uri: context.confirmed.estate.brocher_url}
                            ]
                        }
                    };
                } else {
                    message = {
                        type: "text",
                        text: `${response.displayName}さんからいただいた次のメッセージがわかりませんでした。`
                    };
                }

                // Send 1st message to admin.
                return bot.send(admin_user_id, message);
            })
            .delay(interval).then((response) => {
                // Send original message.
                let message = JSON.parse(JSON.stringify(event.message));
                delete message.id;
                return bot.send(admin_user_id, message);
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
                            {type: "postback", label: "ユーザーに返信する", data: `次のユーザーに返信してください。 ${bot.extract_sender_id()}`}
                        ]
                    }
                }
                return bot.send(admin_user_id, message);
            })
        );

        return Promise.all(tasks).then((response) => {
            return resolve();
        });
    }
};
