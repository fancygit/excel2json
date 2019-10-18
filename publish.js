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
    console.log("发布文件需要的[fileList]文件不存在,请检查");
    process.exit();
}

let originDir = config.originDir;
let fileList = require("./config/fileList");
let versioncode = moment().format("YYYYMMDD");
let subCode = 1;
let versionPath;
if( config.dev ){
    versionPath = config.devDir;
}
else{
    while(true){
        versionPath = util.format("%s/%s_%s",config.versionDir, versioncode, subCode);
        if(fs.existsSync(versionPath)){
            console.log(versionPath, "版本已经存在");
            subCode++;
        }else {
            break;
        }
    }
}

//  创建版本目录
let mkversion = function(){
    mkdirp.sync(versionPath);
};



let copyBasic = function(platform, cb){
    //  检查目标目录是否存在
    let targetPath = util.format("%s/%s", versionPath, platform);
    if(  !fs.existsSync(targetPath)){
        mkdirp.sync(targetPath);
    }

    let useableList = [];
    async.waterfall([
        function (cb) {
            fs.readdir(originDir, function (err, list) {
                list.forEach(function (item) {
                    if( fileList.indexOf(item) !==  -1){
                        useableList.push(item);
                    }
                });
                cb()
            })
        },
        function (cb) {
            let cmd = util.format("cp %s/{%s} %s", originDir, useableList.join(","), targetPath);
            console.log(cmd);
            exec(cmd, cb);
        }
    ],function (error) {
        if(error){
            console.log("拷贝根目录下json出错", error);
            cb();
            return;
        }
        console.log("拷贝根目录下json成功", versioncode, subCode);
        cb();
    })
//  拷贝根目录下的json
};

//  拷贝处理完成的配置文件
// let step2 = function(cb){
//     let cmd_cp_gen_files = util.format("cp %s/%s/*.json %s/", originDir, "genedJson", versionPath);
//     console.log(cmd_cp_gen_files);
//     exec(cmd_cp_gen_files, (error) =>{
//         if(error){
//             console.log("拷贝合成的json出错", error);
//             return;
//         }
//         console.log("拷贝合成的json成功", versioncode, subCode);
//         cb();
//     });
// };

//  拷贝平台相关的配置文件
let copyPlatform = function(platform, cb){
    let platformDir = util.format("%s/%s",  originDir, platform);
    if( !fs.existsSync(platformDir)){
        throw new Error(util.format("目录文件夹不存在:%s", platformDir));
    }

    let targetDir = util.format("%s/%s",  versionPath, platform);
    if( !fs.existsSync(targetDir)){
        mkdirp.sync(targetDir);
    }

    let useableList = [];
    async.waterfall([
        function (cb) {
            fs.readdir(platformDir, function (err, list) {
                list.forEach(function (item) {
                    if( fileList.indexOf(item) !==  -1){
                        useableList.push(item);
                    }
                });
                cb()
            })
        },
        function (cb) {
            if( useableList.length === 0 ){
                cb(null, null, null);
                return;
            }
            let cmd = util.format("cp -R %s/{%s} %s", platformDir, useableList.join(","), targetDir);
            console.log("拷贝平台",cmd);
            exec(cmd, cb);
        },
        function (_, _, cb) {
            let cmd = util.format("cp -r %s/genedJson %s", platformDir, targetDir);
            console.log(cmd);
            exec(cmd, cb);
        }
    ], function (err) {
        if(err){
            console.log("拷贝平台目录下json出错", util.inspect(err));
            cb();
            return;
        }
        console.log("拷贝平台目录下json成功", versioncode, subCode);
        cb();
    });
};

let deleteNoNeed =  function (platform,  cb) {
    let genedDir = util.format("%s/%s/genedJson", versionPath, platform);
    let mvCmd = util.format("mv %s/* %s", genedDir, util.format("%s/%s",  versionPath, platform));
    console.log(mvCmd);
    let cmd = util.format("rm -rf %s", genedDir);
    console.log(cmd);
    async.waterfall([
        function (cb) {
            exec(mvCmd, cb);
        },
        function (_, _, cb) {
            exec(cmd, cb);
        }

    ],function(err){
        if(err){
            console.log("删除genedJson出错", util.inspect(err));
            cb();
            return;
        }
        console.log("删除genedJson成功", versioncode, subCode);
        cb();
    });
};

function start() {
    if( !config.dev ){
        mkversion();
    }

    let tasks = [];

    for(let platform of config.platforms){
        tasks.push(function (cb) {
            copyBasic(platform, cb);
        });

        tasks.push(function (cb) {
            copyPlatform(platform, cb);
        });


        tasks.push(function (cb) {
            deleteNoNeed(platform, cb);
        })
    }

    async.waterfall(tasks,function (err) {
            // let cmd = util.format("%s%s_%s",config.versionDir, versioncode, subCode);
            let cmd = util.format("echo %s_%s > %s/%s", versioncode, subCode, config.versionDir,  "pubVersion.latest");
            exec(cmd, (error)=>{
                if(error){
                    console.log("生成新版本ID出错");
                    return;
                }
                console.log("发布新版本成功", versioncode, subCode);
            });

            let cmd2 = util.format("echo %s > %s/%s", versionPath,  config.versionDir, "pubVersion.path");
            exec(cmd2, (error)=>{
                if(error){
                    console.log("生成新版本路径出错");
                    return;
                }
                console.log("发布新版本路径成功", versioncode, subCode);
            });
        }
    );
}

start();

