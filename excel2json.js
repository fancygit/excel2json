var xlsx = require("node-xlsx");
var fs = require('fs');
var config = require('./config');
var util = require('util');

//var srcDir = "/Users/wangqijun/svn/mstar/design/excel/";
//var srcDir = "/Users/wangqijun/svn/dream/config/excel/";
//var srcDir = "/Users/wangqijun/svn/ddt/config/excel/";
var srcDir = config.srcDir;
var backend = config.backend;
if( !fs.existsSync(srcDir)){
	console.log(srcDir+"不存在，请将xlsx文件放到src目录下");
	process.exit();
}

//var outDir = "./output/";
//var outDir = "/Users/wangqijun/projects/nodejs/dream/game-server/config/logic/";
//var outDir = "/Users/wangqijun/projects/nodejs/fbr/game-server/config/api/";
var outDir = config.outDir;
var httpOutDir = config.httpOutDir;
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
		if( !fileName.startsWith("~") && fileName.endsWith("xlsx")){
			parseByFilePath(srcDir+fileName);
		}
	});
	processJson();
	processJackPot();
	processCrusadeJackPot();
	processPVE();
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

//var fileName = "./1.xlsx";

function parseByFilePath(name){
//	if(name.startsWith("\~")){
//		console.log("不处理临时文件");
//		return;
//	}
	var list = xlsx.parse(name);

	var output = {};
	for(var i in list){
		var sheet = list[i];
		var sheetName = sheet['name'];
		console.log(sheetName);
		var sheetData = sheet['data'];
		output[sheetName] = processDeduct(parseData(sheetData, sheetName));
	}

	for(var sheetName in output){
		fs.writeFileSync(outDir+sheetName+".json", JSON.stringify(output[sheetName], null, 4));
	}

}

function parseData(data, sheetName){
	if( data.length < 4){
		console.log("至少要有四行数据，一行描述，一行类型，一行标题，一行数据");
		return null;
	}
	//	数据起始行
	var startRow = 3;
	//	标题
	var title = data[0];
	//	类型说明
	var typeInfo = data[1];
	//	字段名
	var header = data[2];
	//	可选(列层级配置)
	var layerDef = data[3];
	if( layerDef[0] === 'layerConfig' ){
		startRow = 4;
	}
	else{
		layerDef = null;
	}
	var output = {};
	var output2 = [];

	for(var i=startRow; i<data.length;++i){
		var temp = {};
		var row = [];
		var o_row = data[i];
		for( var oi=0; oi<o_row.length; oi++){
			if( "string" === typeof(o_row[oi]) ){
				var trimedString = o_row[oi].trim();
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
			var row0 = row[0];
			output[row0] = output[row0] || [];
			for( var j=1; j<row.length; j++){
				output[row0].push(row[j]);
			}
		}
		else{
			for(var j in title){
				var column = row[j];
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
					var name = typeInfo[j].slice(5);
					temp[name] = temp[name] || [];
					if( column ){
						temp[name].push(column);
					}
				}
				else{
					temp[header[j]] = column;
				}
			}

			//	数组为空的,则删除该属性
			for(var ti in temp){
				if( ti === "reward" || ti === "reward_num"){
					if( Array.isArray(temp[ti]) && temp[ti].length === 0 ){
						delete temp[ti];
					}
				}
			}
		}

//		if( sheetName !== "zjadvance"){
		if( !layerDef ){
//	if( true){
			//	不带层级关系
			if( typeInfo[0] == "repeat_int" ){
				//	判断typeInfo[1]是否是 sub_int
				if( typeInfo[1] == "subindex"){
					output[temp[header[0]]] = output[temp[header[0]]]  ||  {};
				}
				else if( !output[temp[header[0]]]){
					output[temp[header[0]]] = [];
				}

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
//			}else if( !temp[header[0]]){
//				continue;
			}else{
				output[temp[header[0]]] = temp;
			}
		}
		else{
			//	带层级关系的
			var layer0_key = temp[header[0]];
			var layer1_key,layer2_key;
			var layer1_attr, layer2_attr;
			var layer0 = output[layer0_key] = output[layer0_key] ||  {};
			for(var l=1; l<layerDef.length; l++){
				var layerLevel = layerDef[l];

				if( layerLevel === "m1" ){
					layer1_key = temp[header[l]];
					layer0[layer1_key] = layer0[layer1_key] || {};
					layer0['l1_count'] = layer0['l1_count'] || 0;
					layer0['l1_count']++;
				}

				//	s1与m1均挂在根下
				if( layerLevel === "s1" ){
					var tmp_key = header[l];
					layer0[tmp_key] = temp[header[l]];
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
					var tmp_key = header[l];
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
					var tmp_key = header[l];
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
		var result = {};
		var cailiaozhonglei = 8;
		if( !srcData['cailiao1']){
			return srcData;
		}
		result = srcData;
		result['itemneeds'] = {}; 
		for(var i=1;i<=cailiaozhonglei;i++){
			var name1 = 'cailiao'+i;
			var name2 = 'shuliang'+i;
			if( undefined !== srcData[name1] ){
				var itemid = srcData[name1];
				var value = srcData[name2];
				if( value > 0 ){
					result['itemneeds'][itemid] = value;
				}
				delete result[name1];// = undefined;
				delete result[name2];// = undefined;
			}
		}
		return result;
	}

	var result={};
	for(var id in originDatas){
		var originData = originDatas[id];
		var tmpArray=[];
		if(originData instanceof Array){
			for(var i in originData){
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

function processCrusadeJackPot(){
	var jackPot = require(outDir+"crusade_jackpot");
	var result = {};
	for(var zy in jackPot){
		result[zy] = result[zy] || {};
		let zyConfig = jackPot[zy];
		for( var level in zyConfig){
			result[zy][level] = result[zy][level] || [];
			var i=1;
			while(true){
				var id = zyConfig[level]['id'+i];
				var probability  = zyConfig[level]['probability'+i];
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
	fs.writeFileSync(outDir+"crusade_jackpot.json", JSON.stringify(result, null, 4));
}

function processJackPot(){

	var processedJackPot = {};

	var subProc = function(potName){
		var jackPot = require(outDir+potName);

		for(var id in jackPot){
			var weightInfo = jackPot[id];
			var tmpWeightInfo = [];
			var i=1;
			while(true){
				var dropId = weightInfo['id'+i];
				if( !dropId ){
					break;
				}
				var config = {};
				var names = ['id','probability'];
				var min = weightInfo['min'+i] || weightInfo['min'];
				var max = weightInfo['max'+i] || weightInfo['max'];
				for(var j in names){
					var name = names[j];
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
			processedJackPot[id] = tmpWeightInfo;

		}

	}

	var potNames = ["jackpot.json", "recruit_jackpot.json"];
	for(var i in potNames){
		var potName = potNames[i];
		subProc(potName);
	}

	fs.writeFileSync(outDir+"jackpot.json", JSON.stringify(processedJackPot, null, 4));
	fs.unlinkSync(outDir+'recruit_jackpot.json');
}

function processJson(){
	return;
	//	用于生成gamedrop.json的配置
	var weightDrop = require(outDir+"weightdrop.json");
	var dropConfig  = require(outDir+"drop.json");

	//	生成gamedrop
	var processedWeightDrop = {};
	for(var wdropId in weightDrop){
		var weightInfo = weightDrop[wdropId];
		var tmpWeightInfo = [];
		for(var i=1;i<=8;++i){
			if( !weightInfo['id'+i]){
				continue;
			}
			var config = {};
			var names = ['id','min','max','probability'];
			for(var j in names){
				var name = names[j];
				config[name] = weightInfo[name+i];
			}
			tmpWeightInfo.push(config);
		}
		processedWeightDrop[wdropId] = tmpWeightInfo;
	}

	var processedDropInfo = {};
	for(var dropId in dropConfig){
		var dropInfo = dropConfig[dropId];
		var tmpDropInfo = [];
		for(var i=1;i<=8;++i){
			if( !dropInfo['id'+i]){
				continue;
			}
			var config = {'drop':{}};
			var names = ['id','min','max','probability'];
			config['type'] = dropInfo['type'+i];;
			if( dropInfo['type'+i] === 2){
				//	从权重中读取
				var weightId = dropInfo['id'+i];
				config['drop'] = processedWeightDrop[weightId];
				config['probability'] = dropInfo['probability'+i] || 10000;
			}
			else{
				//	直接从配置中读取
				for(var j in names){
					var name = names[j];
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
	var pveChapterConfig = require(outDir+"pve.json");
	var chapter = 0;
	for(var i in pveChapterConfig){
		if(pveChapterConfig[i]['open'] > 0){
			chapter++;
		}
	}

	for(var i=1;i<=chapter;i++){
		var pveConfig = require(outDir+"pve_"+i+".json");
		var pveUnitConfig = require(outDir+"pve_"+i+"_unit.json");

		//	将两个合成一个
		for(var unitId in pveUnitConfig){
			pveUnitConfig[unitId]['checkpoints'] = pveConfig[unitId];
		}

		fs.unlinkSync(outDir+'pve_'+i+'.json');
		fs.unlinkSync(outDir+'pve_'+i+'_unit.json');
		fs.writeFileSync(outDir+"pve_"+i+".json", JSON.stringify(pveUnitConfig, null, 4));
	}
}

function processEquipEffect(){
	var skillEffectConfig = require(outDir+"unit_skill_effect.json");
	var equipEffectConfig = require(outDir+"equip_effect.json");
	var equipEffectExtraConfig = require(outDir+"equip_effect_extra.json");
	for(var i in equipEffectConfig){
		var equipEffectConfigItem = equipEffectConfig[i];
		//	增幅ID
		var extra = equipEffectConfigItem['extra'];
		var extraDetail = equipEffectExtraConfig[extra];
		equipEffectConfigItem['extra'] = extraDetail;
		skillEffectConfig[i] = equipEffectConfigItem;
	}

	fs.writeFileSync(outDir+"unit_skill_effect.json", JSON.stringify(skillEffectConfig, null, 4));
	fs.unlinkSync(outDir+'equip_effect.json');
}

function processUserInfo(){
	console.log('处理玩家');
	var userInfoAttrConfig = require(outDir+"user_info_attr.json");
	/*
	var result = {};
	for(var i in userInfoAttrConfig){
		result[i.toUpperCase()] = userInfoAttrConfig[i];
	}
	*/
	fs.writeFileSync(outDir+"../../app/consts/userInfoAttr.json", JSON.stringify(userInfoAttrConfig, null, 4));
	fs.unlinkSync(outDir+'user_info_attr.json');
}

function processUnitTalent(){
	console.log('处理天赋');
	var unitTalentConfig = require(outDir+"unit_talent.json");
	var unitTalentBreakConfig = require(outDir+"unit_talent_break.json");
	for(var i in unitTalentConfig){
		var unitTalentConfigItem = unitTalentConfig[i];
		for(var j in unitTalentConfigItem){
			var unitTalentConfigLevelItem = unitTalentConfigItem[j];
			if( typeof(unitTalentConfigLevelItem) == 'string'){
				continue;
			}
			for( var k in unitTalentConfigLevelItem){
				var btid = unitTalentConfigLevelItem[k]['break_through'];
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
	var channelConfig = require(outDir+"3k_channels.json");
	for(var i in channelConfig){
		var channelName = channelConfig[i].toString();
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
	var interflowConfig = require(outDir+"3k_unionChannels.json"); var result = {};
	for(var i in interflowConfig){
		var interflowConfigItem = interflowConfig[i];
		var android = interflowConfigItem['android'];
		var ios = interflowConfigItem['ios'];
		var interflow = interflowConfigItem['interflow'];
		result[android] = interflow;
		result[ios] = interflow;
	}
	fs.writeFileSync(outDir+"../platform/3k/3k_unionChannels.json", JSON.stringify(result, null, 4));
	fs.writeFileSync(httpOutDir+"3k_unionChannels.json", JSON.stringify(result, null, 4));
	fs.writeFileSync("/Users/wangqijun/projects/go/src/github.com/fancygit/smjh/config/platform/3k/"+"3k_unionChannels.json", JSON.stringify(result, null, 4));
	//	移动urls
	var serverConfig = require(outDir+"3k_servers.json");
	var result = {};
	for(var i in serverConfig){
		var serverConfigItem = serverConfig[i];
		result[i] = serverConfigItem;
//		result[i]['http_url'] = result[i]['http_ip'] + ":" +result[i]['http_port'];
//		delete result[i]['http_ip'];
//		delete result[i]['http_port'];
	}

	fs.writeFileSync(outDir+"3k_servers.json", JSON.stringify(result, null, 4));
	fs.writeFileSync(httpOutDir+"3k_servers.json", JSON.stringify(result, null, 4));
//	fs.renameSync(httpOutDir+"3k_servers.json", "/Users/wangqijun/projects/go/src/github.com/fancygit/smjh/config/platform/3k/3k_servers.json");
}

//game_server_10001
function processServers(){
	let start_ids = [10001, 30001];
	start_ids.forEach(function(start_id){
			let num = 1;
			for( let i=0; i<num; i++){
			var serverConfig = require(outDir+util.format("game_server_%d.json", start_id+i));
			var result = {};
			for(let uniqueId in serverConfig){
			var serverConfigItem = serverConfig[uniqueId];
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

