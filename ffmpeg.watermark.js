
const fs = require('fs');
const path = require('path');
const child_process = require('child_process');

let boolArgsKey = [
    'y', 'h', 'v', 'debug',
]

let groupArgsKey = [
    'size', 'color', 'alpha', 'width', 'height'
];
let groupArgsEndKey = ['text', 'file'];

let groupArgsKeyAll = [...groupArgsKey, ...groupArgsEndKey];

function parseArgs(args) {
    /*
    -name hello -t 1
    支持分组的，类似ffmpeg的
    -size 30 -color green -alpha 0.5 -text 文字  |||   -size 20 -color red -alpha 0.35 -text 其他   |||   -width 100 -height 80 -alpha 0.75 -file path/to/image.jpg
    */
    let rs = {
        '_': [],
        '__groups': []
    };
    let group = null;
    let isGroupKey = false;
    let key = null;
    for (let i = 0; i < args.length; i++) {
        let v = args[i];
        if (v.startsWith('-')) {
            key = v.substring(1);
            if (groupArgsKeyAll.includes(key)) {
                // 是组的key
                isGroupKey = true;
                if (group == null) {
                    group = {};
                    rs.__groups.push(group);
                }
            } else {
                isGroupKey = false;
            }
            if (boolArgsKey.includes(key)) {
                if (isGroupKey) {
                    group[key] = true;
                    if (groupArgsEndKey.includes(key)) {
                        group = null;
                    }
                } else {
                    rs[key] = true;
                }
                key = null;
            }
        } else {
            if (key != null) {
                if (isGroupKey) {
                    group[key] = v;
                    if (groupArgsEndKey.includes(key)) {
                        group = null;
                    }
                } else {
                    rs[key] = v;
                }
                key = null;
            } else {
                rs._.push(v);
            }
        }
    }
    return rs;
}

function parseNumber(str, defaultValue) {
    if (str != null) {
        let num = Number(str);
        if (!isNaN(num)) {
            return num;
        }
    }
    return defaultValue;
}

let ffmpegDurationReg = /Duration: (.+?), start: .+?, bitrate: .+/ig;
function tryParseDuration(line) {
    let match = ffmpegDurationReg.exec(line);
    if (match != null) {
        //02:09:44.74
        return parseTimeString2ms(match[1]);
    }
    return null;
}

function parseTimeString2ms(timeStr) {
    try {
        // 将时间字符串拆分成小时、分钟、秒和毫秒
        const [hours, minutes, seconds] = timeStr.trim().split(':');
        // 转换成毫秒
        const totalMilliseconds =
            parseInt(hours) * 60 * 60 * 1000 +
            parseInt(minutes) * 60 * 1000 +
            parseFloat(seconds) * 1000;
        return totalMilliseconds;
    } catch {

    }
}

//frame=   13 fps=8.4 q=1.6 size=  1498kB time=00:01:26.20 bitrate=N/A speed=55.8x    
let ffmpegProgressReg = /frame=(.+?) fps=(.+?) q=(.+?) [L]*size=(.+?) time=(.+?) bitrate=(.+?) speed=([^ ]+)/ig;
function tryParseProgress(line) {
    let match = ffmpegProgressReg.exec(line);
    if (match != null) {
        return {
            frame: parseInt(match[1].trim()),
            fps: parseFloat(match[2].trim()),
            q: parseFloat(match[3].trim()),
            size: match[4].trim(),
            time: parseTimeString2ms(match[5].trim()),
            bitrate: match[6].trim(),
            speed: parseFloat(match[7].trim()),
        }
    }
}

function showCmdHelp() {
    let msg = `${process.argv.slice(0, 2).join(' ')} -i <file|folder> [-temp <folder> ...]
-i              <string>    [必须]要处理的文件或目录
-y                          是否覆盖已经存在的pbf文件，默认：false
-size           <number>    缩略图高度，默认：72
-score          <number>    0.0到1.0之间的值，表示视频帧可能为新场景的概率；建议设置在0.3到0.5之间。太小的值会出现过多场景帧，而太大的值会导致过少的场景帧。默认：0.5
-temp           <string>    缓存目录，默认为脚本所在目录下的“temp”目录
-min-interval   <number>    两个场景帧之间的最小间隔，间隔比这个值小的场景帧将被丢弃，这个值保证书签不会太密集，单位秒，默认：20.0
-max-interval   <number>    两个场景帧之间的最大间隔，如果间隔比这个值大，将在他们之间每max-interval秒取一帧，这个值保证书签不会太稀疏，单位秒，默认：60.0
-h                          显示这个帮助信息
-debug                      是否开启debug模式，打印更详细的日志
`;
    console.log(msg);
}

let videoFormat = ['mp4', 'avi', 'mov', 'mkv', 'wmv', 'flv', 'm4v', 'mpg', 'mpeg', '3gp', 'ts', 'webm', 'mpv'];
function isVideo(filepath) {
    return videoFormat.includes(path.extname(filepath).substring(1).toLowerCase());
}

let imageFormat = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'webp', 'svg', 'tif', 'raw', 'ico'];
function isImage(filepath) {
    return imageFormat.includes(path.extname(filepath).substring(1).toLowerCase());
}

let debug = false;

async function start(args) {
    if (args == null) {
        args = parseArgs(process.argv.slice(2));
    }
    let input = args.i;
    if (input == null || !!args.h) {
        showCmdHelp();
        return;
    }
    if (!fs.existsSync(input)) {
        console.log('输入文件（夹）不存在', input);
        return;
    }
    let inputStat = fs.statSync(input);
    if(inputStat.isDirectory()){
        
    }
    let overwrite = !!args.y;
    let output = args.o || path.join(path.dirname(input), path.basename(input, path.extname(input)) + '_subtitle.jpg');
    if (!overwrite && fs.existsSync(output)) {
        console.log('输出文件已存在，跳过', output);
        return;
    }
    debug = !!args.debug;

    console.log('输入参数：', JSON.stringify(args));
}

module.exports = { start }

// test();
if (process.argv[1] == __filename) {
    start();
}