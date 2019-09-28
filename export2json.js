let xlsx = require("node-xlsx");
let mkdirp = require("mkdirp");
let path = require("path");
let fs = require('fs');
let config = require('./config');
let util = require('util');

let srcDir = config.srcDir;
let pubDir =  config.pubDir;
let backend = config.backend;
let configDir = config.configDir;

if( !fs.existsSync(srcDir)){
    console.log(srcDir+"不存在，请将xlsx文件放到src目录下");
    process.exit();
}

if( !fs.existsSync(pubDir)){
    console.log(pubDir+"不存在，请先创建原始配置文件夹");
    process.exit();
}

if( !fs.existsSync(configDir)){
    mkdirp.sync(configDir);
}

let fileModified = configDir + "/fileModified.json";
if( !fs.existsSync(fileModified)){
    fs.writeFileSync(fileModified, JSON.stringify({}), null, 4);
}

let configFileModified =  require(fileModified);

let exportAll = function(){
    //	遍历 src目录
    fs.readdir(srcDir, function(err, files) {
        if(err){
            console.log("读取文件夹出错");
            process.exit();
        }
        let startTime = Date.now();
        let exportList = [];
        files.forEach(function(fileName) {
            //	只解析xlsx文件,忽略其它
            if( !fileName.startsWith("~") && fileName.endsWith("xlsx")){
                let stat = fs.statSync(srcDir+fileName);
                let mtimeMs = stat.mtimeMs;
                if(  (configFileModified[fileName] && configFileModified[fileName] < mtimeMs)  || !configFileModified[fileName] ){
                    configFileModified[fileName] = mtimeMs;
                    exportList.push(fileName);
                    parseByFilePath(srcDir+fileName);
                }
            }
        });
        let endTime = Date.now();
        console.log("导出文件列表(修改过的):", JSON.stringify(exportList));
        console.log("完全导出总用时:", (endTime-startTime)/1000);
        fs.writeFileSync(fileModified, JSON.stringify(configFileModified, null, 4));
    });
};

/*
    web端调用,直接返回数据流
    @return 出错返回null
 */
let exportBySheet = function(fileName, sheetName) {
    let list = xlsx.parse(fileName);

    let output = null;
    for(let i in list){
        let sheet = list[i];
        let curSheetName = sheet['name'];
        if( curSheetName !== sheetName ){
            continue;
        }

        console.log(util.format("当前处理表单: [%s] [%s]:", path.basename(fileName),  curSheetName));
        let sheetData = sheet['data'];
        output = processDeduct(parseData(sheetData, curSheetName));
    }

    return  output;
};

//  解析单个excel文件
let  parseByFilePath = function(name){
    let startTime = Date.now();
    let list = xlsx.parse(name);

    let output = {};
    for(let i in list){
        let sheet = list[i];
        let sheetName = sheet['name'];
        console.log(util.format("当前处理表单: [%s] [%s]:", path.basename(name),  sheetName));
        let sheetData = sheet['data'];
        output[sheetName] = processDeduct(parseData(sheetData, sheetName));
    }

    let postFixList = ["kkk_oversea", "kkk", "gaea"];
    for(let sheetName in output){
        let postFix = "";
        for( let i=0; i<postFixList.length; i++){
            let temp = postFixList[i];
            if(sheetName.endsWith(temp)){
                postFix = temp;
                break;
            }
        }

        //	特殊处理
        if( sheetName === "store_recharge" && postFix === ""){
            postFix="kkk";
        }

        if( postFix !== "" && !fs.existsSync()){
            mkdirp.sync(pubDir+postFix);
        }

        let fileName = "";
        if( backend && postFix !== ""){
            fileName = postFix + "/" + sheetName.replace("_"+postFix, "");
        }else{
            fileName = sheetName;
        }

        fs.writeFileSync(pubDir+fileName+".json", JSON.stringify(output[sheetName], null, config.jsonSpace));
    }

    let endTime = Date.now();
    let cost = (endTime - startTime)/1000;
    console.log(util.format("耗时:(%d)s", cost));
};

let parseData = function(data, sheetName){
    if( data.length < 4){
        console.log("[格式不正确]: [sheet]至少要有四行数据，一行描述，一行类型，一行标题，一行数据");
        return null;
    }

    //	数据起始行
    let startRow = 3;
    //	标题
    let fieldTitleInfo = data[0];
    //	类型说明
    let fieldTypeInfo = data[1];
    //	字段名
    let fieldNames = data[2];
    //	可选(列层级配置)
    let layerDef = data[3];
    if( layerDef[0] === 'layerConfig' ){
        startRow = 4;
    }
    else{
        layerDef = null;
    }

    if( startRow == 4 ){
        console.log("特殊的[sheet]", sheetName,  "包含了层级信息");
    }

    let output = {};
    let output2 = [];

    for(let curRowNum=startRow; curRowNum<data.length;++curRowNum){
        //  逐行处理
        let temp = {};
        let row = [];
        //  原始行信息
        let origin_row = data[curRowNum];
        if( origin_row.length === 0 ){
            continue;
        }

        for( let column=0; column<origin_row.length; column++){
            if( "string" === typeof(origin_row[column]) ){
                //  处理字符串中带有空格字符的情况
                let trimedString = origin_row[column].trim();
                if( trimedString === "" ){
                    row.push(undefined);
                }
                else{
                    row.push(origin_row[column].trim());
                }
            }
            else{
                row.push(origin_row[column]);
            }
        }

        if( fieldTypeInfo[0] == 'kv'){
            //  特殊处理1：两列(第一列为key,第二列为值,第三列标明第二列是否是json数据)
            if( row[2] == "json"){
                output[row[0]] = JSON.parse(row[1]);
            }
            else{
                output[row[0]] = row[1];
            }
            continue;
        }
        else if( fieldTypeInfo[0] == 'jackpot' ){
            console.log("[Error][还在使用jackpot类型的sheet]", sheetName);
            //  特殊处理二: 处理jackpot类型
            let row0 = row[0];
            output[row0] = output[row0] || [];
            for( let j=1; j<row.length; j++){
                output[row0].push(row[j]);
            }
        }
        else{
            let uselessField =[];
            for(let index in fieldTitleInfo){
                let column = row[index];
                let fieldType = fieldTypeInfo[index];
                if( fieldType === 'ignore'){
                    //  忽略的字段
                    continue;
                }
                if( 'json' === fieldType ){
                    //  处理json
                    try{
                        column = JSON.parse(column);
                    }catch(e){
                        if( column ){
                            console.log("处理json出错", sheetName, "line:", curRowNum, "json:", column);
                        }
                        column = undefined;
                    }
                }

                //	将分割的数组重新组合
                if(fieldType && fieldType.startsWith("join_")){
                    //  多个字段组成一个json的情况(join_fieldName)
                    let realFieldName = fieldType.slice(5);
                    temp[realFieldName] = temp[realFieldName] || [];
                    if( column ){
                        temp[realFieldName].push(column);
                    }
                }
                else{
                    //  普通字段
                    fieldName = fieldNames[index];
                    temp[fieldName] = column;
                }
            }

            uselessField.forEach(function (field) {
                delete temp[field];
            });

            //	数组为空的,则删除该属性
            for(let ti in temp){
                if( ti === "reward" || ti === "reward_num"){
                    if( Array.isArray(temp[ti]) && temp[ti].length === 0 ){
                        delete temp[ti];
                    }
                }
            }
        }

//		if( sheetName !== "zjadvance"){
        if( !layerDef ){
            //	不带层级关系
            if( fieldTypeInfo[0] == "repeat_int" ){
                if( fieldTypeInfo[1] == "subindex"){
                    if(fieldTypeInfo[2] && fieldTypeInfo[2] == "3rdindex") {
                        //	三层
                        let col1 = temp[fieldNames[0]];
                        let col2 = temp[fieldNames[1]];
                        let col3 = temp[fieldNames[2]];
                        output[col1] = output[col1] || {};
                        output[col1][col2] = output[col1][col2] || {};
                        output[col1][col2][col3] = temp;
                    }else {
                        //	二层
                        let col1 = temp[fieldNames[0]];
                        let col2 = temp[fieldNames[1]];
                        output[col1] = output[col1] || {};
                        output[col1][col2] = temp;
                    }
                }
                else {
                    let col1 = temp[fieldNames[0]];
                    let col2 = temp[fieldNames[1]];
                    // output[col1]
                    // output[temp[header[0]]] = [];
                    output[col1] = output[col1] || [];
                    if(!fieldTypeInfo[2]){
                        // output[temp[header[0]]].push(temp[header[1]]);
                        output[col1].push(col2);
                    }
                    else{
                        output[col1].push(temp);
                        // output[temp[header[0]]].push(temp);
                    }
                }
            }else{
                output[temp[fieldNames[0]]] = temp;
            }
        }
        else{
            //	带层级关系的
            let layer0_key = temp[fieldNames[0]];
            let layer1_key,layer2_key;
            let layer1_attr, layer2_attr;
            let layer0 = output[layer0_key] = output[layer0_key] ||  {};
            for(let l=1; l<layerDef.length; l++){
                let layerLevel = layerDef[l];

                if( layerLevel === "m1" ){
                    layer1_key = temp[fieldNames[l]];
                    layer0[layer1_key] = layer0[layer1_key] || {};
                    layer0['l1_count'] = layer0['l1_count'] || 0;
                    layer0['l1_count']++;
                }

                //	s1与m1均挂在根下
                if( layerLevel === "s1" ){
                    let tmp_key = fieldNames[l];
                    if( fieldTypeInfo[l].startsWith("join_")){
                        tmp_key = fieldTypeInfo[l].slice(5);
                    }
                    // layer0[tmp_key] = temp[header[l]];
                    layer0[tmp_key] = temp[tmp_key];
                }

                //	m2下可以挂m3和s3
                if( layerLevel === "m2" ){
                    layer2_key = temp[fieldNames[l]];
                    layer0[layer1_key][layer2_key] = layer0[layer1_key][layer2_key] || {};
                    layer0['l2_count'] = layer0['l2_count'] || 0;
                    layer0['l2_count']++;
                }

                //	s2挂在m1下
                if( layerLevel === "s2" ){
                    let tmp_key = fieldNames[l];
                    if( fieldTypeInfo[l].startsWith('join')){
                        tmp_key = fieldTypeInfo[l].slice(5);
                        layer0[layer1_key][tmp_key] = temp[tmp_key];
                    }
                    else{
                        layer0[layer1_key][tmp_key] = temp[fieldNames[l]];
                    }
                    layer0[layer1_key][fieldNames[0]] = temp[fieldNames[0]];
                    layer0[layer1_key][fieldNames[1]] = temp[fieldNames[1]];
                }

                //	s3挂在m2下
                if( layerLevel === "s3" ){
                    let tmp_key = fieldNames[l];
                    if( fieldTypeInfo[l].startsWith('join')){
                        tmp_key = fieldTypeInfo[l].slice(5);
                        layer0[layer1_key][layer2_key][tmp_key] = temp[tmp_key];
                    }
                    else{
                        layer0[layer1_key][layer2_key][tmp_key] = temp[fieldNames[l]];
                    }
                    layer0[layer1_key][layer2_key][fieldNames[0]] = temp[fieldNames[0]];
                    layer0[layer1_key][layer2_key][fieldNames[1]] = temp[fieldNames[1]];
                }
            }
        }
    }
    delete output["undefined"];// = undefined;
    return output2.length>0 ? output2 : output;
};

let processDeduct = function(originDatas){
    function realProcess(srcData){
        // if( !srcData ){
        // 	return {};
        // }
        let result = {};
        let cailiaozhonglei = 8;
        if( !srcData['cailiao1']){
            return srcData;
        }
        result = srcData;
        result['itemneeds'] = {};
        for(let i=1;i<=cailiaozhonglei;i++){
            let name1 = 'cailiao'+i;
            let name2 = 'shuliang'+i;
            if( undefined !== srcData[name1] ){
                let itemid = srcData[name1];
                let value = srcData[name2];
                if( value > 0 ){
                    result['itemneeds'][itemid] = value;
                }
                delete result[name1];// = undefined;
                delete result[name2];// = undefined;
            }
        }
        return result;
    }

    let result={};
    for(let id in originDatas){
        let originData = originDatas[id];
        let tmpArray=[];
        if(originData instanceof Array){
            for(let i in originData){
                tmpArray.push(realProcess(originData[i]));
            }
            result[id] = tmpArray;
        }
        else{
            result[id] = realProcess(originData);
        }
    }

    if( !result){
        return result;
    }
    else{
        return originDatas;
    }
};

exportAll();

module.exports.exportAll = exportAll;
module.exports.exportBySheet = exportBySheet;
