"use strict";

Promise = require('bluebird');
const debug = require('debug')('bot-express:skill');

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

    finish(bot, event, context, resolve, reject){
        let first_message = context.previous.message[context.previous.message.length - 1];

        let first_message_text = first_message.message.data;
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
