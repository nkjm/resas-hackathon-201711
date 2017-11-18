"use strict";

const request = require("request");
const debug = require("debug")("bot-express:service");
Promise = require("bluebird");
Promise.promisifyAll(request);

const endpoint = "https://apex.oracle.com/pls/apex/evangelist/resas";

module.exports = class ServiceDb {
    static get_estate(hwid){
        return ServiceDb._get("estate/" + hwid);
    }

    static _get(path){
        let url = endpoint + "/" + path;
        return request.getAsync({
            url: url,
            json: true
        }).then((response) => {
            if (response.statusCode != 200){
                return Promise.reject(new Error(`GET ${url} failed.`));
            } else {
                if (!response.body.items || response.body.items.length === 0){
                    return null;
                }
                return response.body.items[0];
            }
        });
    }
}
