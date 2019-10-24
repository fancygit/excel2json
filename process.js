let fs = require("fs");
let mkdirp = require("mkdirp");
let config = require('./config');
let util =  require("util");

let originDir = config.originDir;
let genDir = util.format('%s/%s', originDir , "genedJson");

function getPlatformGenedDir(platform) {
    let genPlatformDir =  util.format("%s/%s/%s", originDir, platform, "genedJson");
    if( !fs.existsSync(genPlatformDir)){
        mkdirp.sync(genPlatformDir);
    }

    return genPlatformDir;
}

function autoSelectFile(platform, fileName) {
    let  filePath = util.format("%s/%s/%s", originDir, platform, fileName);
    // console.log(filePath);
    if( !fs.existsSync(filePath)){
        filePath = util.format("%s/%s", originDir, fileName);
    }

    if( !fs.existsSync(filePath)){
        console.log(util.format("[%s] 路径不存在: [%s]", platform, filePath));
        return "";
    }

    return filePath;
}

/**
 * 处理多个process
 */
function processJackPot(platform){
    let result = {};
    let subProc = function(fileName){
        let filePath = autoSelectFile(platform,  fileName);
        if(  filePath == "" ){
            return;
        }

        // let jackPot = require(filePath);
        let jackPot =  JSON.parse(fs.readFileSync(filePath,'utf-8'));

        for(let id in jackPot){
            //  原始平铺的权重信息
            let originWeightInfo = jackPot[id];
            //  转换成结构化的权重信息
            let usefulWeightInfo = [];
            let sequence = 1;
            while(true){
                let dropId = originWeightInfo['id'+sequence];
                if( !dropId ){
                    break;
                }
                let item = {};
                let fileds = ['id','probability'];
                let min = originWeightInfo['min'+sequence] || originWeightInfo['min'];
                let max = originWeightInfo['max'+sequence] || originWeightInfo['max'];
                for(let index in fileds){
                    let field = fileds[index];
                    item[field] = originWeightInfo[field+sequence];
                    if( min ){
                        item['min'] = min;
                    }
                    if( max) {
                        item['max'] = max;
                    }
                }
                usefulWeightInfo.push(item);
                sequence++;
            }
            result[id] = usefulWeightInfo;
        }
    };

    let filesNames = ["jackpot.json", "recruit_jackpot.json"];
    filesNames.forEach(subProc);

    let genPlatformDir =  getPlatformGenedDir(platform);

    //  生成新文件
    fs.writeFileSync(util.format("%s/%s",genPlatformDir,"jackpot.json"), JSON.stringify(result, null, config.jsonSpace));
}

function processEquipEffect(platform){
    let  fileList = ["unit_skill_effect.json", "equip_effect.json", "equip_effect_extra.json"];
    let  filePathList = [];
    for (let  fileName of fileList ){
        filePathList.push(autoSelectFile(platform,  fileName));
    }

    let bOK = true;
    filePathList.forEach(function (item) {
        if(item  == "" ){
            bOK = false;
        }
    });

    if( !bOK){
        console.log("处理equipEffect出错");
        return;
    }

    // let skillEffectConfig = require(filePathList[0]);
    // let equipEffectConfig = require(filePathList[1]);
    // let equipEffectExtraConfig = require(filePathList[2]);
    let skillEffectConfig =  JSON.parse(fs.readFileSync(filePathList[0],'utf-8'));
    let equipEffectConfig =  JSON.parse(fs.readFileSync(filePathList[1], 'utf-8'));
    let equipEffectExtraConfig =  JSON.parse(fs.readFileSync(filePathList[2], 'utf-8'));
    for(let i in equipEffectConfig){
        let equipEffectConfigItem = equipEffectConfig[i];
        //	增幅ID
        let extra = equipEffectConfigItem['extra'];
        let extraDetail = equipEffectExtraConfig[extra];
        equipEffectConfigItem['extra'] = extraDetail;
        skillEffectConfig[i] = equipEffectConfigItem;
    }

    let genPlatformDir =  getPlatformGenedDir(platform);
    fs.writeFileSync(util.format("%s/%s", genPlatformDir,"unit_skill_effect.json"), JSON.stringify(skillEffectConfig, null, config.jsonSpace));
    // fs.unlinkSync(genDir+'equip_effect.json');
}

function processUserInfo(){
    // let  filePath = util.format("%s/%s", originDir, "user_info_attr.json");
    // let userInfoAttrConfig = require(filePath);
    // let genPlatformDir =  getPlatformGenedDir(platform);
    // fs.writeFileSync(util.format("%s/%s", genDir,"userInfoAttr.json"), JSON.stringify(userInfoAttrConfig, null, config.jsonSpace));
}

function processUnitTalent(platform){
    let file1 = "unit_talent.json";
    let file2 = "unit_talent_break.json";
    let unitTalentConfig,unitTalentBreakConfig;

    let file1Path = autoSelectFile(platform,  file1);
    let file2Path = autoSelectFile(platform,  file2);

    if( file1Path ==  "" || file2Path == ""){
        console.log("处理天赋出错，文件不存在");
        return;
    }

    // unitTalentConfig = require(file1Path);
    unitTalentConfig =  JSON.parse(fs.readFileSync(file1Path,'utf-8'));
    // unitTalentBreakConfig = require(file2Path);
    unitTalentBreakConfig =  JSON.parse(fs.readFileSync(file2Path,'utf-8'));

    for(let i in unitTalentConfig){
        let unitTalentConfigItem = unitTalentConfig[i];
        for(let j in unitTalentConfigItem){
            let unitTalentConfigLevelItem = unitTalentConfigItem[j];
            if( typeof(unitTalentConfigLevelItem) == 'string'){
                continue;
            }
            for( let k in unitTalentConfigLevelItem){
                let btid = unitTalentConfigLevelItem[k]['break_through'];
                if( !isNaN(btid)){
                    unitTalentConfigLevelItem[k]['break_through'] = unitTalentBreakConfig[btid];
                }
            }
        }
    }

    let genPlatformDir =  getPlatformGenedDir(platform);
    fs.writeFileSync(util.format("%s/%s", genPlatformDir,"unit_talent.json"), JSON.stringify(unitTalentConfig, null, config.jsonSpace));
    // fs.unlinkSync(genDir+'unit_talent_break.json');
}

function translateCommonJackPot2(platform, fileName){
    let filePath = autoSelectFile(platform,  fileName);
    if(  filePath == "" ){
        return;
    }

    let jackPot = require(filePath);
    let result = {};
    for(let zy in jackPot){
        result[zy] = result[zy] || [];
        let zyConfig = jackPot[zy];
        let i=1;
        while(true){
            let id = zyConfig['id'+i];
            let probability  = zyConfig['probability'+i];
            if( !id || !probability){
                break;
            }
            result[zy].push({id:id, probability:probability});
            i++;
        }
    }

    let genPlatformDir =  getPlatformGenedDir(platform);
    fs.writeFileSync(util.format("%s/%s", genPlatformDir,fileName), JSON.stringify(result, null, config.jsonSpace));
}

function translateCommonJackPot(platform, fileName){
    let filePath = autoSelectFile(platform,  fileName);
    if(  filePath == "" ){
        return;
    }
    // let filePath =  util.format("%s/%s", originDir, fileName);
    let jackPot = require(filePath);
    let result = {};
    for(let zy in jackPot){
        result[zy] = result[zy] || {};
        let zyConfig = jackPot[zy];
        for( let level in zyConfig){
            result[zy][level] = result[zy][level] || [];
            let i=1;
            while(true){
                let id = zyConfig[level]['id'+i];
                let probability  = zyConfig[level]['probability'+i];
                if( !id || !probability){
                    break;
                }
                result[zy][level].push({id:id, probability:probability});
                i++;
            }
        }
    }

    let genPlatformDir =  getPlatformGenedDir(platform);
    fs.writeFileSync(util.format("%s/%s", genPlatformDir,fileName), JSON.stringify(result, null, config.jsonSpace));
}

let process = function () {
    //  前端不处理
    if( config.backend ){
        //  合并jackpot
        for(let platform of config.platforms){
            processJackPot(platform);
        }
        processUserInfo();
    }

    let translateList1 = ['crusade_jackpot.json'];
    let translateList2 = ['turntable_num.json'];
    //  特殊处理
    for(let platform  of config.platforms){
        for(let fileName of translateList1){
            translateCommonJackPot(platform, fileName);
        }

        for(let fileName of translateList2){
            translateCommonJackPot2(platform, fileName);
        }
        processEquipEffect(platform);
        processUnitTalent(platform);
    }
    // translateList1.forEach(translateCommonJackPot);
    // translateList2.forEach(translateCommonJackPot2);
    //  合并装备特效
    //  合并驱动者天赋
};

process();

module.exports.process  = process;
