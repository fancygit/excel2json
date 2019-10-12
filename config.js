let config = module.exports ;

//  [不要修改]
config.configDir = __dirname + "/config";

/**
 * 配置区
 * @type {boolean}
 */
//  后台导出是分文件夹的，前端是不带文件夹的
config.backend = true;
//  4是带缩进的，0是压缩不带缩进的
config.jsonSpace = 4;
//  excel源目录文件夹
config.srcDir = "/Users/dotboy/svn/smjh/ddt/config/excel/";
//  原始目录
config.originDir = "/Users/dotboy/pub_versions/smjh/config/origin";

/**
 * 前端忽略区
 * @type {string}
 */
config.constFilePath = "/Users/dotboy/projects/webstorm/smjh/fbr/game-server/app/consts/consts.js";
//  最终输出目录
config.outDir = "/Users/dotboy/projects/webstorm/smjh/fbr/game-server/config/api/";
//  发出的版本目录
config.versionDir = "/Users/dotboy/pub_versions/smjh/config/version";
//  平台列表
config.platforms = ['kkk','kkk_oversea','reku'];
//  模式
config.dev = true;
config.devDir  = "/Users/dotboy/projects/webstorm/smjh/fbr/game-server/config/api";
