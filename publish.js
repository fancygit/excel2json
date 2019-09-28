/**
 发布新的配置文件版本
 **/
let moment = require("moment");
let fs = require("fs");
let util = require("util");
let mkdirp = require("mkdirp");
let config = require("./config.js");
let async  = require("async");
const { exec } = require('child_process');

if( !fs.existsSync("./config/fileList.json")){
    console.log("fileList文件不存在");
    process.exit();
}

let srcDir = config.pubDir;
let fileList = require("./config/fileList");
let versioncode = moment().format("YYYYMMDD");
let subCode = 1;
let versionPath;
while(true){
    versionPath = util.format("%s%s_%s",config.versionDir, versioncode, subCode);
    if(fs.existsSync(versionPath)){
        console.log(versionPath, "版本已经存在");
        subCode++;
    }else {
        break;
    }
}

//  创建版本目录
let mkversion = function(){
    mkdirp.sync(versionPath);
};

let step1 = function(cb){
//  拷贝根目录下的json
    let cmd = util.format("cp %s{%s} %s", srcDir, fileList.join(","), versionPath);
// console.log(cmd);
    exec(cmd, (error) =>{
        if(error){
            console.log("拷贝根目录下json出错", error);
            return;
        }
        console.log("拷贝根目录下json成功", versioncode, subCode);
        cb();
    });
};

//  拷贝处理完成的配置文件
let step2 = function(cb){
    let cmd_cp_gen_files = util.format("cp %s%s/*.json %s/", srcDir, "genedJson", versionPath);
    console.log(cmd_cp_gen_files);
    exec(cmd_cp_gen_files, (error) =>{
        if(error){
            console.log("拷贝合成的json出错", error);
            return;
        }
        console.log("拷贝合成的json成功", versioncode, subCode);
        cb();
    });
};

//  拷贝平台相关的配置文件
let step3 = function(cb){
    let files = fs.readdirSync(srcDir);
    files.forEach(function (file) {
        if( file === "genedJson"){
            return;
        }
        let  srcFile = srcDir + file;
        fs.stat(srcDir+file, function (err, st) {
            if(err){
                throw err;
            }

            if (st.isDirectory()  ){
                let cmd = util.format("cp -r %s %s", srcFile, versionPath);
                exec(cmd, function (error) {
                    if(error){
                        console.log("拷贝平台配置的json出错", error);
                        return;
                    }
                    console.log("拷贝平台配置的的json成功", versioncode, subCode);
                })
            }
        })
    });
    cb();
};

function start() {
    mkversion();
    async.waterfall([
            function(cb){
                step1(cb);
            },

            function(cb){
                step2(cb);
            },
            function(cb){
                step3(cb);
            }
        ],function (err) {

        }
    );
}

start();

