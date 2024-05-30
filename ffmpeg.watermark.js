
const fs = require('fs');
const path = require('path');
const child_process = require('child_process');

let boolArgsKey = [
    'y', 'h', 'v', 'debug',
]

let groupArgsKey = [
    'fontsize', 'fontcolor', 'fontfile', 'fontborderwidth', 'fontbordercolor', 'alpha', 'width', 'height', 'left', 'top', 'right', 'bottom',
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

function getAllMediaFile(dir) {
    let list = fs.readdirSync(dir, { withFileTypes: true });
    let rs = [];
    for (const item of list) {
        let fullpath = path.join(dir, item.name);
        if (item.isFile()) {
            if (isImage(fullpath) || isVideo(fullpath)) {
                rs.push(fullpath);
            }
        } else if (item.isDirectory()) {
            let sublist = getAllMediaFile(fullpath);
            rs.push(...sublist);
        }
    }
    return rs;
}

let debug = false;
let defaultFontfile = 'c:/Windows/Fonts/msyh.ttc';

async function addWatermark(input, outputfile, args) {
    let isvideo = isVideo(input);
    let startTime = Date.now();
    let cmd = 'ffmpeg';
    let filter_complex = '';

    let groups = args.__groups;
    // 水印文件在ffmpeg -i 中的序号
    let sourceIndex = 1;
    let sourceinputs = [];
    let inputFilterName = '[0:v]';
    let outputFilterIndex = 1;
    let outputFilterName = inputFilterName;
    for (let i = 0; i < groups.length; i++) {
        const group = groups[i];
        outputFilterName = `[v${outputFilterIndex++}]`;
        let left = parseNumber(group.left, null);
        let top = parseNumber(group.top, null);
        let right = parseNumber(group.right, null);
        let bottom = parseNumber(group.bottom, null);
        if (left == null && right == null) {
            right = 20;
        }
        if (top == null && bottom == null) {
            top = 20;
        }
        let alpha = parseNumber(group.alpha, 1);
        if (group.text) {
            // 文字。文字直接绘制在源画面上
            let text = group.text.replace(/\\n/g, '\n');
            let fontsize = parseNumber(group.fontsize, 20);
            let fontcolor = group.fontcolor || 'white';
            let fontfile = path.resolve(group.fontfile || defaultFontfile);
            let fontBorderWidth = parseNumber(group.fontborderwidth, 0);
            let fontBorderColor = group.fontbordercolor || 'black';
            if (!fs.existsSync(fontfile)) {
                console.log('字体文件不存在', fontfile);
                return;
            }
            fontfile = fontfile.replace(/\\/g, '/');
            filter_complex += `${inputFilterName}drawtext=text='${text}':fontsize=${fontsize}:fontcolor=${fontcolor}@${alpha}:`
                + `x=${right == null ? (left > 1 ? left : `(w-tw)*${left}`) : (right > 1 ? `w-tw-${right}` : `(w-tw)*${1 - right}`)}:`
                + `y=${bottom == null ? (top > 1 ? top : `(h-th)*${top}`) : (bottom > 1 ? `h-th-${bottom}` : `(h-th)*${1 - bottom}`)}:`
                + `fontfile='${fontfile}':`
                + `borderw=${fontBorderWidth}:bordercolor=${fontBorderColor}@${alpha}:text_align=center+middle${outputFilterName};`;
            inputFilterName = outputFilterName;
        } else if (group.file) {
            // 图片或视频
            sourceinputs.push('-i', group.file);
        }
    }

    let ffmpeg_args = [
        '-y', '-hide_banner',
        '-i', input,
        ...sourceinputs,
        '-filter_complex', filter_complex,
        // 输出视频的一些参数，这里只用了质量控制参数 -crf 23，可自行添加如 -c:v libx265 等
        '-map', outputFilterName,
        '-crf', '23',
        outputfile
    ];
    if (debug) {
        console.log(cmd, ffmpeg_args.map(i => i.includes(' ') ? `"${i}"` : i).join(' '));
    }
    let output = '';
    // 输入视频的时长，单位毫秒
    let duration = null;
    let offset = 0;
    let progressPosition = 0;
    await new Promise((resolve, reject) => {
        let p = child_process.execFile(cmd, ffmpeg_args, {});
        p.on('exit', (code) => {
            if (process.stdin.isTTY) {
                process.stdout.write('\n');
            }
            if (code == 0) {
                resolve(code);
            } else {
                reject(code);
            }
        });
        p.stderr.on('data', (chunk) => {
            output += chunk + '';
            while (true) {
                let index = output.indexOf('\n', offset);
                let index2 = output.indexOf('\r', offset);
                if (index == -1 && index2 == -1) {
                    break;
                }
                if (index == -1) {
                    index = Number.MAX_SAFE_INTEGER;
                }
                if (index2 == -1) {
                    index2 = Number.MAX_SAFE_INTEGER;
                }
                index = Math.min(index, index2);
                let line = output.substring(offset, index);
                offset = index + 1;
                duration = duration || tryParseDuration(line);
                let progress = tryParseProgress(line);
                if (progress != null) {
                    progressPosition = progress.time;
                } else {
                    continue;
                }
                if (isNaN(progressPosition)) {
                    continue;
                }
                let progressStr = duration != null && progressPosition != 0 ? `处理进度：${(progressPosition / 1000).toFixed(2).padStart(7, ' ')} 秒（${(progressPosition / duration * 100).toFixed(2).padStart(5, ' ')}%）` : '';
                let msg = progressStr;
                if (!process.stdin.isTTY) {
                    console.log(msg);
                } else {
                    process.stdout.write('\r' + msg);
                }
            }
            if (debug) {
                if (!process.stdin.isTTY) {
                    console.log(chunk + '');
                } else {
                    process.stdout.write(chunk);
                }
            }
        });
    });
    let processTime = Date.now() - startTime;
    console.log('处理完毕。耗时：', processTime / 1000, '秒');
}

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
    let overwrite = !!args.y;
    debug = !!args.debug;
    let inputStat = fs.statSync(input);
    // 不管单个文件还是目录，均当成文件列表来处理
    let filelist = [];
    if (inputStat.isDirectory()) {
        filelist = getAllMediaFile(input);
    } else {
        filelist = [input];
    }
    console.log('开始处理。');
    console.log(
        `输入文件（夹）：${input}
待处理文件数量：${filelist.length}`);
    // 遍历文件列表
    for (let i = 0; i < filelist.length; i++) {
        let inputfile = filelist[i];
        let output = args.o || path.dirname(inputfile);
        if (fs.statSync(output).isDirectory()) {
            output = path.join(output, path.basename(inputfile, path.extname(inputfile)) + '_watermark' + path.extname(inputfile));
        }
        if (!overwrite && fs.existsSync(output)) {
            console.log('输出文件已存在，跳过', output);
            continue;
        }
        fs.mkdirSync(path.dirname(output), { recursive: true });
        await addWatermark(inputfile, output, args);
    }
    console.log('全部处理完成。即将退出脚本。');
}

module.exports = { start }

// test();
if (process.argv[1] == __filename) {
    start();
}