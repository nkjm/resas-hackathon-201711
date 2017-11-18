"use strict";

const request = require("request");
const debug = require("debug")("bot-express:service");
Promise = require("bluebird");
Promise.promisifyAll(request);

const endpoint = "https://opendata.resas-portal.go.jp";

module.exports = class ServiceResas {
    constructor(api_key){
        this.api_key = api_key;
    }

    get_prefectures(){
        return this._get("api/v1/prefectures");
    }

    _get(path){
        let url = endpoint + "/" + path;
        let headers = {
            "X-API-KEY": this.api_key
        }
        return request.getAsync({
            url: url,
            headers: headers,
            json: true
        }).then((response) => {
            if (response.statusCode != 200){
                return Promise.reject(new Error(`GET ${url} failed.`));
            } else if (response.body.statusCode && response.body.statusCode != 200){
                debug(response.body);
                return Promise.reject(new Error(response.body.description));
            } else {
                return response.body;
            }
        });
    }
}
