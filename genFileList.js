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
    console.log(configName);
    if(  util.isString(configName) && configName.startsWith("acti")){
        let a=3;
    }
    if( i == "UNIT_UPGRADE_PREFIX"){
        for(let j=1; j<=4; j++){
            let realConfigName = configName+j;
            neededConfigNames.push(realConfigName);
        }
    }
    else if( util.isString(configName)){
        neededConfigNames.push(configName);
    }
    else if( util.isObject(configName)){
        for(let j in configName){
            let realConfigName = configName[j];
            neededConfigNames.push(realConfigName);
        }
    }
}

let  result = [];
let addSuffix = function(fileName){
    let withSuffix = fileName + ".json";
    // let filePath = util.format("%s/%s",  config.originDir, withSuffix);
    // if( fs.existsSync(filePath)){
    result.push(fileName+".json");
    // }
};

neededConfigNames.forEach(addSuffix);
fs.writeFileSync(fileList, JSON.stringify(result, null, 4));
