let fs = require("fs");
let mkdirp = require("mkdirp");
let config = require('./config');

let pubDir = config.pubDir;
let genDir = pubDir + "genedJson/";

if( !fs.existsSync(genDir)){
    mkdirp.sync(genDir);
}

/**
 * 处理多个process
 */
function processJackPot(){
    let result = {};
    let subProc = function(jsonFileName){
        let jackPot = require(pubDir+jsonFileName);

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

    //  生成新文件
    fs.writeFileSync(genDir+"jackpot.json", JSON.stringify(result, null, config.jsonSpace));
}

function processEquipEffect(){
    let skillEffectConfig = require(pubDir+"unit_skill_effect.json");
    let equipEffectConfig = require(pubDir+"equip_effect.json");
    let equipEffectExtraConfig = require(pubDir+"equip_effect_extra.json");
    for(let i in equipEffectConfig){
        let equipEffectConfigItem = equipEffectConfig[i];
        //	增幅ID
        let extra = equipEffectConfigItem['extra'];
        let extraDetail = equipEffectExtraConfig[extra];
        equipEffectConfigItem['extra'] = extraDetail;
        skillEffectConfig[i] = equipEffectConfigItem;
    }

    fs.writeFileSync(genDir+"unit_skill_effect.json", JSON.stringify(skillEffectConfig, null, config.jsonSpace));
    // fs.unlinkSync(genDir+'equip_effect.json');
}

function processUserInfo(){
    let userInfoAttrConfig = require(pubDir+"user_info_attr.json");
    fs.writeFileSync(genDir+"userInfoAttr.json", JSON.stringify(userInfoAttrConfig, null, config.jsonSpace));
}

function processUnitTalent(){
    let unitTalentConfig = require(pubDir+"unit_talent.json");
    let unitTalentBreakConfig = require(pubDir+"unit_talent_break.json");
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
    fs.writeFileSync(genDir+"unit_talent.json", JSON.stringify(unitTalentConfig, null, config.jsonSpace));
    // fs.unlinkSync(genDir+'unit_talent_break.json');
}

function translateCommonJackPot2(fileName){
    let jackPot = require(pubDir+fileName);
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
    fs.writeFileSync(genDir+fileName+".json", JSON.stringify(result, null, config.jsonSpace));
}

function translateCommonJackPot(fileName){
    let jackPot = require(pubDir+fileName);
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

    fs.writeFileSync(genDir+fileName+".json", JSON.stringify(result, null, config.jsonSpace));
}

let process = function () {
    //  合并jackpot
    processJackPot();
    //  特殊处理
    let translateList1 = ['crusade_jackpot'];
    let translateList2 = ['turntable_num'];
    translateList1.forEach(translateCommonJackPot);
    translateList2.forEach(translateCommonJackPot2);
    //  合并装备特效
    processEquipEffect();
    if( config.backend ){
        processUserInfo();
    }
    //  合并驱动者天赋
    processUnitTalent();
};

process();

module.exports.process  = process;
