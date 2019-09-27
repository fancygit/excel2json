let xlsx = require("node-xlsx");
let fs = require('fs');
let config = require('./config');
let util = require('util');

let srcDir = config.srcDir;
let backend = config.backend;
if( !fs.existsSync(srcDir)){
	console.log(srcDir+"不存在，请将xlsx文件放到src目录下");
	process.exit();
}

let outDir = config.outDir;
//	检查输出文件夹是否存在
if( !fs.existsSync(outDir)){
	fs.mkdirSync(outDir);
}

//	遍历 src目录
fs.readdir(srcDir, function(err, files) {
	if(err){
		console.log("读取文件夹出错");
		process.exit();
	}
	files.forEach(function(fileName) {
		//	只解析xlsx文件,忽略其它
		console.log(fileName);
		// if( fileName.startsWith("装备")){
		// 	return;
		// }
		if( !fileName.startsWith("~") && fileName.endsWith("xlsx")){
			parseByFilePath(srcDir+fileName);
		}
	});
	processJson();
	try{
		processJackPot();
	}
	catch(e){
		console.log(e);
	}
	let translateList1 = ['crusade_jackpot'];
	let translateList2 = ['turntable_num'];
	translateList1.forEach(function (name) {
		translateCommonJackPot(name);
	});
	translateList2.forEach(function (name) {
		translateCommonJackPot2(name);
	});

	// processTurnTableJackpot("turntable_jackpot");
	// processPVE();
	processEquipEffect();
	//	处理userInfoAttr
	if( backend ){
		processUserInfo();
		//	处理3k平台所需要的配置
		//process3K();
		//processServers();
	}
	processUnitTalent();
});

//let fileName = "./1.xlsx";

function parseByFilePath(name){
	let list = xlsx.parse(name);
	console.log("解析完成");

	let output = {};
	for(let i in list){
		let sheet = list[i];
		let sheetName = sheet['name'];
		console.log(sheetName);
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

		let fileName = "";
		if( backend && postFix !== ""){
			fileName = postFix + "/" + sheetName.replace("_"+postFix, "");
		}else{
		    fileName = sheetName;
		}

		fs.writeFileSync(outDir+fileName+".json", JSON.stringify(output[sheetName], null, 4));
	}

}

function parseData(data, sheetName){
	if( data.length < 4){
		console.log("至少要有四行数据，一行描述，一行类型，一行标题，一行数据");
		return null;
	}
	//	数据起始行
	let startRow = 3;
	//	标题
	let title = data[0];
	//	类型说明
	let typeInfo = data[1];
	//	字段名
	let header = data[2];
	//	可选(列层级配置)
	let layerDef = data[3];
	if( layerDef[0] === 'layerConfig' ){
		startRow = 4;
	}
	else{
		layerDef = null;
	}
	let output = {};
	let output2 = [];

	for(let i=startRow; i<data.length;++i){
		let temp = {};
		let row = [];
		let o_row = data[i];
		for( let oi=0; oi<o_row.length; oi++){
			if( "string" === typeof(o_row[oi]) ){
				let trimedString = o_row[oi].trim();
				if( trimedString === "" ){
					row.push(undefined);
				}
				else{
					row.push(o_row[oi].trim());
				}
			}
			else{
				row.push(o_row[oi]);
			}
		}

		if( typeInfo[0] == 'kv'){
			if( row[2] == "json"){
				output[row[0]] = JSON.parse(row[1]);
			}
			else{
				output[row[0]] = row[1];
			}
			continue;
		}
		else if( typeInfo[0] == 'jackpot' ){
			let row0 = row[0];
			output[row0] = output[row0] || [];
			for( let j=1; j<row.length; j++){
				output[row0].push(row[j]);
			}
		}
		else{
			let uselessField =[];
			for(let j in title){
				let column = row[j];
				if( typeInfo[j] === 'ignore'){
					continue;
				}
				if( 'json' === typeInfo[j]){
					if (column){
						column = JSON.parse(column);
					}
				}

				//	将分割的数组重新组合
				if(typeInfo[j] && typeInfo[j].startsWith("join_")){
					let name = typeInfo[j].slice(5);
					temp[name] = temp[name] || [];
					if( column ){
						temp[name].push(column);
					}
				}
				else{
					temp[header[j]] = column;
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
			if( typeInfo[0] == "repeat_int" ){
				if( typeInfo[1] == "subindex"){
					if(typeInfo[2] && typeInfo[2] == "3rdindex") {
					    //	三层
						let col1 = temp[header[0]];
						let col2 = temp[header[1]];
						let col3 = temp[header[2]];
						output[col1] = output[col1] || {};
						output[col1][col2] = output[col1][col2] || {};
						output[col1][col2][col3] = temp;
					}else {
						//	二层
						let col1 = temp[header[0]];
						let col2 = temp[header[1]];
						output[col1] = output[col1] || {};
						output[col1][col2] = temp;
					}
				}
				else {
					let col1 = temp[header[0]];
					let col2 = temp[header[1]];
					// output[col1]
					// output[temp[header[0]]] = [];
					output[col1] = output[col1] || [];
					if(!typeInfo[2]){
						// output[temp[header[0]]].push(temp[header[1]]);
						output[col1].push(col2);
					}
					else{
					    output[col1].push(temp);
						// output[temp[header[0]]].push(temp);
					}
				}

				/*
				if( output[temp[header[0]]] instanceof Array){
					//	只有两列的情况
					if(!typeInfo[2]){
						output[temp[header[0]]].push(temp[header[1]]);
					}
					else{
						output[temp[header[0]]].push(temp);
					}
				}
				else{
					output[temp[header[0]]][temp[header[1]]]=temp;
				}
				*/
			// }else if( !temp[header[0]]){
			// 	continue;
			}else{
				output[temp[header[0]]] = temp;
			}
		}
		else{
			//	带层级关系的
			let layer0_key = temp[header[0]];
			let layer1_key,layer2_key;
			let layer1_attr, layer2_attr;
			let layer0 = output[layer0_key] = output[layer0_key] ||  {};
			for(let l=1; l<layerDef.length; l++){
				let layerLevel = layerDef[l];

				if( layerLevel === "m1" ){
					layer1_key = temp[header[l]];
					layer0[layer1_key] = layer0[layer1_key] || {};
					layer0['l1_count'] = layer0['l1_count'] || 0;
					layer0['l1_count']++;
				}

				//	s1与m1均挂在根下
				if( layerLevel === "s1" ){
					let tmp_key = header[l];
					if( typeInfo[l].startsWith("join_")){
						tmp_key = typeInfo[l].slice(5);
					}
					// layer0[tmp_key] = temp[header[l]];
					layer0[tmp_key] = temp[tmp_key];
				}

				//	m2下可以挂m3和s3
				if( layerLevel === "m2" ){
					layer2_key = temp[header[l]];
					layer0[layer1_key][layer2_key] = layer0[layer1_key][layer2_key] || {};
					layer0['l2_count'] = layer0['l2_count'] || 0;
					layer0['l2_count']++;
				}

				//	s2挂在m1下
				if( layerLevel === "s2" ){
					let tmp_key = header[l];
					if( typeInfo[l].startsWith('join')){
						tmp_key = typeInfo[l].slice(5);
						layer0[layer1_key][tmp_key] = temp[tmp_key];
					}
					else{
						layer0[layer1_key][tmp_key] = temp[header[l]];
					}
					layer0[layer1_key][header[0]] = temp[header[0]];
					layer0[layer1_key][header[1]] = temp[header[1]];
				}

				//	s3挂在m2下
				if( layerLevel === "s3" ){
					let tmp_key = header[l];
					if( typeInfo[l].startsWith('join')){
						tmp_key = typeInfo[l].slice(5);
						layer0[layer1_key][layer2_key][tmp_key] = temp[tmp_key];
					}
					else{
						layer0[layer1_key][layer2_key][tmp_key] = temp[header[l]];
					}
					layer0[layer1_key][layer2_key][header[0]] = temp[header[0]];
					layer0[layer1_key][layer2_key][header[1]] = temp[header[1]];
				}
			}
		}
	}
	delete output["undefined"];// = undefined;
	return output2.length>0 ? output2 : output;
}

function processDeduct(originDatas){
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
}

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

function processJson(){
	return;
	//	用于生成gamedrop.json的配置
	let weightDrop = require(outDir+"weightdrop.json");
	let dropConfig  = require(outDir+"drop.json");

	//	生成gamedrop
	let processedWeightDrop = {};
	for(let wdropId in weightDrop){
		let weightInfo = weightDrop[wdropId];
		let tmpWeightInfo = [];
		for(let i=1;i<=8;++i){
			if( !weightInfo['id'+i]){
				continue;
			}
			let config = {};
			let names = ['id','min','max','probability'];
			for(let j in names){
				let name = names[j];
				config[name] = weightInfo[name+i];
			}
			tmpWeightInfo.push(config);
		}
		processedWeightDrop[wdropId] = tmpWeightInfo;
	}

	let processedDropInfo = {};
	for(let dropId in dropConfig){
		let dropInfo = dropConfig[dropId];
		let tmpDropInfo = [];
		for(let i=1;i<=8;++i){
			if( !dropInfo['id'+i]){
				continue;
			}
			let config = {'drop':{}};
			let names = ['id','min','max','probability'];
			config['type'] = dropInfo['type'+i];;
			if( dropInfo['type'+i] === 2){
				//	从权重中读取
				let weightId = dropInfo['id'+i];
				config['drop'] = processedWeightDrop[weightId];
				config['probability'] = dropInfo['probability'+i] || 10000;
			}
			else{
				//	直接从配置中读取
				for(let j in names){
					let name = names[j];
					config['drop'][name] = dropInfo[name+i];
				}
			}
			tmpDropInfo.push(config);
		}
		processedDropInfo[dropId] = tmpDropInfo;
	}

	fs.writeFileSync(outDir+"gamedrop.json", JSON.stringify(processedDropInfo, null, 4));
	fs.unlinkSync(outDir+'drop.json');
	fs.unlinkSync(outDir+'weightdrop.json');
}

function processPVE(){
	return;
	let pveChapterConfig = require(outDir+"pve.json");
	let chapter = 0;
	for(let i in pveChapterConfig){
		if(pveChapterConfig[i]['open'] > 0){
			chapter++;
		}
	}

	for(let i=1;i<=chapter;i++){
		let pveConfig = require(outDir+"pve_"+i+".json");
		let pveUnitConfig = require(outDir+"pve_"+i+"_unit.json");

		//	将两个合成一个
		for(let unitId in pveUnitConfig){
			pveUnitConfig[unitId]['checkpoints'] = pveConfig[unitId];
		}

		fs.unlinkSync(outDir+'pve_'+i+'.json');
		fs.unlinkSync(outDir+'pve_'+i+'_unit.json');
		fs.writeFileSync(outDir+"pve_"+i+".json", JSON.stringify(pveUnitConfig, null, 4));
	}
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

function process3K(){
	console.log('处理3k配置文件');
	let channelConfig = require(outDir+"3k_channels.json");
	for(let i in channelConfig){
		let channelName = channelConfig[i].toString();
		if( channelName.indexOf("无") >=0 || channelName.indexOf("作废") > 0){
			delete channelConfig[i];
		}
		else{
			channelConfig[i] = channelName.trim();
		}
	}
	fs.writeFileSync(outDir+"../platform/3k/3k_channels.json", JSON.stringify(channelConfig, null, 4));
	fs.writeFileSync(httpOutDir+"3k_channels.json", JSON.stringify(channelConfig, null, 4));
	fs.unlinkSync(outDir+'3k_channels.json');

	//	数据互通
	let interflowConfig = require(outDir+"3k_unionChannels.json");
	// let result = {};
	for(let i in interflowConfig){
		let interflowConfigItem = interflowConfig[i];
		let android = interflowConfigItem['android'];
		let ios = interflowConfigItem['ios'];
		let interflow = interflowConfigItem['interflow'];
		result[android] = interflow;
		result[ios] = interflow;
	}
	fs.writeFileSync(outDir+"../platform/3k/3k_unionChannels.json", JSON.stringify(result, null, 4));
	fs.writeFileSync(httpOutDir+"3k_unionChannels.json", JSON.stringify(result, null, 4));
	fs.writeFileSync("/Users/wangqijun/projects/go/src/github.com/fancygit/smjh/config/platform/3k/"+"3k_unionChannels.json", JSON.stringify(result, null, 4));
	//	移动urls
	let serverConfig = require(outDir+"3k_servers.json");
	let result = {};
	for(let i in serverConfig){
		let serverConfigItem = serverConfig[i];
		result[i] = serverConfigItem;
//		result[i]['http_url'] = result[i]['http_ip'] + ":" +result[i]['http_port'];
//		delete result[i]['http_ip'];
//		delete result[i]['http_port'];
	}

	fs.writeFileSync(outDir+"3k_servers.json", JSON.stringify(result, null, 4));
	fs.writeFileSync(httpOutDir+"3k_servers.json", JSON.stringify(result, null, 4));
}

//game_server_10001
function processServers(){
	let start_ids = [10001, 30001];
	start_ids.forEach(function(start_id){
			let num = 1;
			for( let i=0; i<num; i++){
			let serverConfig = require(outDir+util.format("game_server_%d.json", start_id+i));
			let result = {};
			for(let uniqueId in serverConfig){
			let serverConfigItem = serverConfig[uniqueId];
			let category = serverConfigItem['category'];
			let id = serverConfigItem['id'];
			let clientHost = serverConfigItem['clientHost'];
			let clientPort = serverConfigItem['clientPort'];
			let host = serverConfigItem['host'];
			let port = serverConfigItem['port'];
			let frontend = serverConfigItem['frontend'];
			let auto_restart = serverConfigItem['auto-restart'];
			if( frontend === 0 ){
			frontend = false;
			}
			else if( frontend === 1){
			frontend = true;
			}
			if( auto_restart === 0 ){
				auto_restart = false;
			}
			else if( auto_restart === 1){
				auto_restart = true;
			}
			let serverData = {};
			serverData['id'] = id;
			serverData['clientHost'] = clientHost;
			serverData['clientPort'] = clientPort;
			serverData['host'] = host;
			serverData['port'] = port;
			if( frontend ){
				serverData['frontend'] = frontend;
			}
			if( auto_restart ){
				serverData['auto-restart'] = auto_restart;
			}
			result[category] = result[category] || [];
			result[category].push(serverData);
			}

			if( !fs.existsSync(config.serverOutDir)){
				fs.mkdirSync(config.serverOutDir);
			}

			fs.writeFileSync(config.serverOutDir+util.format("%d/production/servers.json", start_id+i), JSON.stringify(result, null, 4));
			}
	});
}

