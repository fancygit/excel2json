/**
 * 处理多个process
 */
function processJackPot(){

    let processedJackPot = {};

    let subProc = function(potName){
        let jackPot = require(outDir+potName);

        for(let id in jackPot){
            let weightInfo = jackPot[id];
            let tmpWeightInfo = [];
            let i=1;
            while(true){
                let dropId = weightInfo['id'+i];
                if( !dropId ){
                    // console.log("缺少dropId", id);
                    //	为了退出循环
                    break;
                }
                let config = {};
                let names = ['id','probability'];
                let min = weightInfo['min'+i] || weightInfo['min'];
                let max = weightInfo['max'+i] || weightInfo['max'];
                for(let j in names){
                    let name = names[j];
                    config[name] = weightInfo[name+i];
                    if( min ){
                        config['min'] = min;
                    }
                    if( max) {
                        config['max'] = max;
                    }
                }
                tmpWeightInfo.push(config);
                i++;
            }
            //console.log(tmpWeightInfo);
            processedJackPot[id] = tmpWeightInfo;
        }
    };

    let potNames = ["jackpot.json", "recruit_jackpot.json"];
    for(let i in potNames){
        let potName = potNames[i];
        subProc(potName);
    }
//console.log(processedJackPot);

    fs.writeFileSync(outDir+"jackpot.json", JSON.stringify(processedJackPot, null, 4));
    //fs.unlinkSync(outDir+'recruit_jackpot.json');
}

function processEquipEffect(){
    let skillEffectConfig = require(outDir+"unit_skill_effect.json");
    let equipEffectConfig = require(outDir+"equip_effect.json");
    let equipEffectExtraConfig = require(outDir+"equip_effect_extra.json");
    for(let i in equipEffectConfig){
        let equipEffectConfigItem = equipEffectConfig[i];
        //	增幅ID
        let extra = equipEffectConfigItem['extra'];
        let extraDetail = equipEffectExtraConfig[extra];
        equipEffectConfigItem['extra'] = extraDetail;
        skillEffectConfig[i] = equipEffectConfigItem;
    }

    fs.writeFileSync(outDir+"unit_skill_effect.json", JSON.stringify(skillEffectConfig, null, 4));
    fs.unlinkSync(outDir+'equip_effect.json');
}

function processUserInfo(){
    console.log('处理玩家');
    let userInfoAttrConfig = require(outDir+"user_info_attr.json");
    /*
    let result = {};
    for(let i in userInfoAttrConfig){
        result[i.toUpperCase()] = userInfoAttrConfig[i];
    }
    */
    fs.writeFileSync(outDir+"../../app/consts/userInfoAttr.json", JSON.stringify(userInfoAttrConfig, null, 4));
    fs.unlinkSync(outDir+'user_info_attr.json');
}

function processUnitTalent(){
    console.log('处理天赋');
    let unitTalentConfig = require(outDir+"unit_talent.json");
    let unitTalentBreakConfig = require(outDir+"unit_talent_break.json");
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
    fs.writeFileSync(outDir+"unit_talent.json", JSON.stringify(unitTalentConfig, null, 4));
    fs.unlinkSync(outDir+'unit_talent_break.json');
};

function translateCommonJackPot2(fileName){
    let jackPot = require(outDir+fileName);
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
    fs.writeFileSync(outDir+fileName+".json", JSON.stringify(result, null, 4));
}

function translateCommonJackPot(fileName){
    let jackPot = require(outDir+fileName);
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
//				config.push({id:id,probability:probability});
                result[zy][level].push({id:id, probability:probability});
                i++;
            }
            //jackPot[zy][level]=config;
        }
    }
    fs.writeFileSync(outDir+fileName+".json", JSON.stringify(result, null, 4));
}

let process = function () {
    //  合并jackpot
    processJackPot();
    //  特殊处理
    let translateList1 = ['crusade_jackpot'];
    let translateList2 = ['turntable_num'];
    translateList1.forEach(function (name) {
        translateCommonJackPot(name);
    });
    translateList2.forEach(function (name) {
        translateCommonJackPot2(name);
    });

    //  合并装备特效
    processEquipEffect();
    if( backend ){
        processUserInfo();
    }
    //  合并驱动者天赋
    processUnitTalent();
};

module.exports.process  = process;
