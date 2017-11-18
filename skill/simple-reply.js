'use strict';

Promise = require('bluebird');
const db = require("../service/kozu-db");
const debug = require('debug')('bot-express:skill');
const app_env = require("../environment_variables");

module.exports = class SkillSimpleReply {

    constructor(){
        this.required_parameter = {
            body: {
                message_to_confirm: {
                    text: "OK. 本文プリーズ"
                }
            },
            user_id: {
                message_to_confirm: {
                    text: "ユーザーIDをプリーズ"
                }
            }
        }

        this.clear_context_on_finish = true;
    }

    begin(bot, event, context, resolve, reject){
        // Notify other administrators that this case has been handled.
        debug(`Going to notify other administrators that this case is handled.`);
        let admin_user_id_list = [];
        let user;
        return Promise.resolve().then((response) => {
            // Get the admin list.
            return db.get_admin_list();
        }).then((response) => {
            for (let admin of response){
                if (admin.user_id != bot.extract_sender_id()){
                    admin_user_id_list.push(admin.user_id);
                }
            }
            debug(`We got ${admin_user_id_list.length} administrators to notify.`);
            // Get user detail.
            if (context.intent.parameters && context.intent.parameters.user_id){
                return bot.plugin.line.sdk.getProfile(context.intent.parameters.user_id);
            }
            return Promise.resolve();
        }).then((response) => {
            if (response){
                user = response;
            }
            // Get admin detail who handles this case.
            return bot.plugin.line.sdk.getProfile(bot.extract_sender_id());
        }).then((response) => {
            let admin = response;
            let message;
            if (user){
                message = {
                    type: "text",
                    text: `${admin.displayName}さんが${user.displayName}さんに返信するとのこと。`
                }
            } else {
                message = {
                    type: "text",
                    text: `${admin.displayName}が返信するとのこと。`
                }
            }
            if (admin_user_id_list.length == 0){
                return Promise.resolve();
            }
            return bot.multicast(admin_user_id_list, message);
        }).then((response) => {
            debug(`Sent notification to ${admin_user_id_list.length} administrators.`);
            return resolve();
        });
    }

    finish(bot, event, context, resolve, reject){
        let first_message = context.previous.message[context.previous.message.length - 1];

        let first_message_text;
        if (bot.type == "line"){
            first_message_text = first_message.message.data;
        } else if (bot.type == "facebook"){
            first_message_text = first_message.message.payload;
        }

        // Promise List.
        let tasks = [];

        // ### Tasks Overview ###
        // -> Reply to administrator. Just say OK.
        // -> Send message to original user.

        // -> Reply to administrator. Just say OK.
        tasks.push(bot.reply({
            text: "了解。ユーザーへ返信しておきますー。"
        }));

        // -> Reply to original user.
        tasks.push(bot.send(context.confirmed.user_id, {
            text: context.confirmed.body
        }));

        return Promise.all(tasks).then((response) => {
            return resolve();
        });
    }
};
