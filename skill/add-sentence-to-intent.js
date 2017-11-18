"use strict";

const debug = require("debug")("bot-express:skill");
const fs = require("fs");
const apiai = require("../service/apiai");
const sharp = require("sharp");
const Dropbox = require("dropbox");
const request = require("request");
const dbx = new Dropbox({ accessToken: process.env.DROPBOX_ACCESS_TOKEN });
const SKIP_INTENT_LIST = [
    "Default Fallback Intent",
    "Default Welcome Intent",
    "add-sentence-to-intent",
    "simple-reply",
    "管理者にしてください",
    "管理者を引退します",
    "キャンセル",
    "leave",
    "アンケートに回答しません",
    "survey-distribution",
    "registration",
    "survey"
];

Promise = require("bluebird");
Promise.promisifyAll(request);

module.exports = class SkillAddSentenceToIntent {
    constructor(){
        this.required_parameter = {
            sentence: {
                message_to_confirm: {
                    type: "text",
                    text: "追加する例文を教えてください。" // We do not expect this message will be delivered.
                }
            },
            intent_id: {
                message_to_confirm: {
                    type: "text",
                    text: "この例文を追加するIntentを教えてください。" // We do not expect this message will be delivered.
                }
            }
        }

        this.optional_parameter = {
            reporter_id: {},
            intent_name: {
                message_to_confirm: {
                    type: "template",
                    altText: "Intent名をどうぞ。",
                    template: {
                        type: "buttons",
                        text: "Intent名をどうぞ。",
                        actions: [
                            {type: "message", label: "例文をIntent名にする", text: ""}
                        ]
                    }
                },
                reaction: (error, value, bot, event, context, resolve, reject) => {
                    if (error) return resolve();
                    let skill_scripts = fs.readdirSync(__dirname);
                    context.confirmed.skill_list = [];
                    for (let skill_script of skill_scripts){
                        context.confirmed.skill_list.push(skill_script.replace(".js", ""));
                    }

                    let offset = 1;
                    for (let skill of context.confirmed.skill_list){
                        this.optional_parameter.skill.message_to_confirm.text += `${offset} ${skill}\n`;
                        offset++;
                    }

                    bot.collect({
                        skill: {
                            message_to_confirm: this.optional_parameter.skill.message_to_confirm,
                            parser: this.optional_parameter.skill.parser,
                            reaction: this.optional_parameter.skill.reaction
                        }
                    });
                    return resolve();
                }
            },
            skill: {
                message_to_confirm: {
                    type: "text",
                    text: "採用するスキルの番号をどうぞ。\n"
                },
                parser: (value, bot, event, context, resolve, reject) => {
                    if (Number(value) !== NaN && Number.isInteger(Number(value)) && Number(value) > 0){
                        if (Number(value) <= context.confirmed.skill_list.length){
                            // User selected existing skill.
                            return resolve(context.confirmed.skill_list[Number(value) - 1]);
                        }
                    }
                    // Invalid.
                    return reject();
                },
                reaction: (error, value, bot, event, context, resolve, reject) => {
                    if (error) return resolve();
                    bot.collect("add_fulfillment");
                    return resolve();
                }
            },
            add_fulfillment: {
                message_to_confirm: {
                    type: "template",
                    altText: "応答を追加しますか？（はい・いいえ）",
                    template: {
                        type: "confirm",
                        text: "応答を追加しますか？",
                        actions: [
                            {type: "message", label: "はい", text: "はい"},
                            {type: "message", label: "いいえ", text: "いいえ"},
                        ]
                    }
                },
                parser: (value, bot, event, context, resolve, reject) => {
                    if (["はい","いいえ"].includes(value)){
                        return resolve(value);
                    }
                    return reject();
                },
                reaction: (error, value, bot, event, context, resolve, reject) => {
                    if (error) return resolve();
                    if (value == "はい"){
                        bot.collect("fulfillment");
                    }
                    return resolve();
                }
            },
            fulfillment: {
                message_to_confirm: {
                    type: "text",
                    text: "応答をどうぞ。＊サポートされているのはtext, sticker, location, imageです。"
                },
                parser: (value, bot, event, context, resolve, reject) => {
                    if (bot.identify_message_type() == "text"){
                        return resolve(value);
                    } else if (bot.identify_message_type() == "sticker" || bot.identify_message_type() == "location"){
                        let parsed_value = JSON.parse(JSON.stringify(value));
                        delete parsed_value.id;
                        return resolve(parsed_value);
                    } else if (bot.identify_message_type() == "image"){
                        let preview_buffer;
                        let original_buffer;
                        return Promise.resolve()
                        .then((response) => {
                            // Retrieve image from LINE
                            let url = `https://api.line.me/v2/bot/message/${event.message.id}/content`;
                            let headers = {
                                "Authorization": "Bearer " + process.env.LINE_CHANNEL_ACCESS_TOKEN
                            }
                            let preview_buffer;
                            let original_buffer;
                            return request.getAsync({
                                url: url,
                                headers: headers,
                                encoding: null
                            });
                        })
                        .then((response) => {
                            // Create preview
                            original_buffer = response.body;
                            return sharp(response.body).resize(240, 240).toBuffer();
                        })
                        .then((response) => {
                            // Upload preview and original image. Then create public link.
                            preview_buffer = response;

                            let upload_tasks = [];
                            debug("Going to upload original image to dbx.");
                            upload_tasks.push(dbx.filesUpload({
                                path: '/original/' + event.message.id + '.jpg',
                                mode: {
                                    ".tag": "overwrite"
                                },
                                contents: original_buffer
                            }).then(
                                (response) => {
                                    debug("Uploaded original image to dbx.");
                                    debug("Going to create public link of original image.");
                                    return dbx.sharingCreateSharedLink({
                                        path: "/original/" + event.message.id + '.jpg',
                                        short_url: false
                                    });
                                }
                            ).then(
                                (response) => {
                                    debug("Create following public link of original image.");
                                    debug(response);
                                    return response.url.replace("?dl=0", "?raw=1");
                                }
                            ));

                            debug("Going to upload preview image to dbx.");
                            upload_tasks.push(dbx.filesUpload({
                                path: '/preview/' + event.message.id + '.jpg',
                                mode: {
                                    ".tag": "overwrite"
                                },
                                contents: preview_buffer
                            }).then(
                                (response) => {
                                    debug("Uploaded preview image to dbx.");
                                    debug("Going to create public link of preview image.");
                                    return dbx.sharingCreateSharedLink({
                                        path: "/preview/" + event.message.id + '.jpg',
                                        short_url: false
                                    });
                                }
                            ).then(
                                (response) => {
                                    debug("Create following public link of preview image.");
                                    debug(response);
                                    return response.url.replace("?dl=0", "?raw=1");
                                }
                            ));

                            return Promise.all(upload_tasks);
                        })
                        .then((response) => {
                            debug("Created follwing public links.");
                            debug(response);
                            let parsed_value = {
                                type: "image",
                                originalContentUrl: response[0],
                                previewImageUrl: response[1]
                            }
                            return resolve(parsed_value);
                        });
                    }
                    return reject();
                }
            },
            ask_retry: {
                message_to_confirm: {
                    type: "template",
                    altText: "学習できたらユーザーにもう一度試してもらうようにお願いしますか？（はい・いいえ）",
                    template: {
                        type: "confirm",
                        text: "学習できたらユーザーにもう一度試してもらうようにお願いしますか？",
                        actions: [
                            {type: "message", label: "はい", text: "はい"},
                            {type: "message", label: "いいえ", text: "いいえ"},
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

        this.clear_context_on_finish = true;
    }

    begin(bot, event, context, resolve, reject){
        return apiai.get_intent_list().then(
            (all_intent_list) => {
                debug("We remove intents specified in SKIP_INTENT_LIST.");
                let intent_list = [];
                for (let intent of all_intent_list){
                    if (!SKIP_INTENT_LIST.includes(intent.name)){
                        intent_list.push(intent);
                    }
                }

                // Save intent list to context.
                context.confirmed.intent_list = intent_list;
                debug(`We have ${intent_list.length} intent(s).`);


                let message = {
                    type: "text",
                    text: "この例文を追加するIntentの番号を教えてください。\n"
                }
                let offset = 1;
                for (let intent of intent_list){
                    message.text += `${offset} ${intent.name}\n`;
                    offset++;
                }
                message.text += `${offset} 新しいIntent`;

                bot.collect({
                    intent_id: {
                        message_to_confirm: message,
                        parser: (value, bot, event, context, resolve, reject) => {
                            if (Number(value) !== NaN && Number.isInteger(Number(value)) && Number(value) > 0){
                                if (Number(value) <= context.confirmed.intent_list.length){
                                    // User selected existing intent.
                                    return resolve(context.confirmed.intent_list[Number(value) - 1].id);
                                } else if (Number(value) === (context.confirmed.intent_list.length + 1)){
                                    // User selected new intent.
                                    return resolve(null);
                                }
                            }
                            // Invalid.
                            return reject();
                        },
                        reaction: (error, value, bot, event, context, resolve, reject) => {
                            if (error){
                                return resolve();
                            }
                            if (value === null){
                                // We collect "intent_name";
                                this.optional_parameter.intent_name.message_to_confirm.template.actions[0].text = context.confirmed.sentence;
                                bot.collect({
                                    intent_name: {
                                        message_to_confirm: this.optional_parameter.intent_name.message_to_confirm,
                                        parser: this.optional_parameter.intent_name.parser,
                                        reaction: this.optional_parameter.intent_name.reaction
                                    }
                                });
                            }
                            return resolve();
                        }
                    }
                });
                return resolve();
            }
        )
    }

    finish(bot, event, context, resolve, reject){
        if (context.confirmed.reporter_id && context.confirmed.ask_retry === undefined){
            bot.collect("ask_retry");
            return resolve();
        }

        let learning_completed;
        if (context.confirmed.intent_id != null){
            // We add new sentence to existing intent.
            learning_completed = apiai.add_sentence(context.confirmed.intent_id, context.confirmed.sentence);
        } else if (context.confirmed.intent_name && context.confirmed.skill){
            // We add new intent and add new sentence and text response to the newly created intent.
            learning_completed = apiai.add_intent(context.confirmed.intent_name, context.confirmed.skill, context.confirmed.sentence, context.confirmed.fulfillment);
        }

        return learning_completed.then((response) => {
            // Reply to admin
            let message = {
                type: "text",
                text: "追加完了しました。"
            }
            if (context.confirmed.ask_retry){
                message.text += "ユーザーにも再試行をお願いしておきますね。";
            }
            return bot.reply(message);
        })
        .delay(5000).then((response) => {
            // Ask retry to reporter.
            if (context.confirmed.ask_retry){
                return bot.send(context.confirmed.reporter_id, {
                    type: "template",
                    altText: `あ、さっきの「${context.confirmed.sentence}」の件、わかりました。次は対応できると思いますのでもう一度試していただけませんか？`,
                    template: {
                        type: "buttons",
                        text: `あ、さっきの「${context.confirmed.sentence}」の件、わかりました。次は対応できると思いますのでもう一度試していただけませんか？`,
                        actions: [
                            {type: "message", label: "試す", text: context.confirmed.sentence}
                        ]
                    }
                });
            } else {
                return Promise.resolve();
            }
        })
        .then((response) => {
            return resolve();
        });
    }
}
