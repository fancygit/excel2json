//  生成所需要的文件列表
let util = require('util');
let fs = require('fs');
let config = require("./config.js");
let mkdirp = require("mkdirp");
let usedConfigInApp = require(config.constFilePath).ConfigName;
let configPath = "./config/";
let fileList = configPath + "fileList.json";

if( !fs.existsSync(configPath) ){
    mkdirp.sync(configPath);
}

if( !fs.existsSync(fileList) ){
    fs.writeFileSync(fileList, JSON.stringify({}, null, config.jsonSpace));
}

let neededConfigNames = [];
for(let i in usedConfigInApp){
    let configName = usedConfigInApp[i];
    if( i == "UNIT_UPGRADE_PREFIX"){
        for(let j=1; j<=4; j++){
            let realConfigName = configName+j;
            neededConfigNames.push(realConfigName);
            // if (!fs.existsSync(configPath + realConfigName+ ".json") ){
            //     console.log(realConfigName+"配置文件不存在");
            // }
        }
    }
    else if( util.isString(configName)){
        neededConfigNames.push(configName);
        // if (!fs.existsSync(configPath + configName + ".json") ){
        //     console.log(configName+"配置文件不存在");
        // }
    }
    else if( util.isObject(configName)){
        for(let j in configName){
            let realConfigName = configName[j];
            neededConfigNames.push(realConfigName);
            // if (!fs.existsSync(configPath + realConfigName + ".json") ){
            //     console.log(realConfigName+"配置文件不存在");
            // }
        }
    }
}

let  result = [];
let addSuffix = function(fileName){
    let withSuffix = fileName + ".json";
    let filePath = util.format("%s%s",  config.pubDir, withSuffix);
    if( fs.existsSync(filePath)){
        result.push(fileName+".json");
    }
};

neededConfigNames.forEach(addSuffix);

fs.writeFileSync(fileList, JSON.stringify(result, null, 4));
//  删除不需要的配置文件
/*
fs.readdirSync(configPath).forEach(function (filename) {
    if (!/\.json$/.test(filename)) {
        return;
    }

    let path = require('path');
    let name = path.basename(filename, '.json');
    if( neededConfigNames.indexOf(name) == -1){
       console.log("不需要:"+name);
        fs.unlinkSync(configPath+filename);
    }
});
 */
