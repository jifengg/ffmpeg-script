
const fs = require('fs');
const path = require('path');
const child_process = require('child_process');

let boolArgsKey = [
    'y', 'h', 'v', 'debug',
]
function parseArgs(args) {
    /*
    -name hello -t 1
    */
    let rs = {
        '_': []
    };
    let key = null;
    for (let i = 0; i < args.length; i++) {
        let v = args[i];
        if (v.startsWith('-')) {
            key = v.substring(1);
            if (boolArgsKey.includes(key)) {
                rs[key] = true;
                key = null;
            }
        } else {
            if (key != null) {
                rs[key] = v;
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
let ffmpegProgressReg = /frame=(.+?) fps=(.+?) q=(.+?) size=(.+?) time=(.+?) bitrate=(.+?) speed=([^ ]+)/ig;
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
-i          <string>    [必须]视频文件路径
-t          <string>    [必须]文本文件路径。用两个换行符分隔的字幕，支持用一个换行符实现字幕换行
-o          <string>    生成的图片文件路径，默认：<输入视频文件名>_subtitle.jpg
-y                      是否覆盖已经存在的图片文件，默认：false
-size       <number>    生成的图片宽度，默认：400
-ss         <number>    从视频的第几秒开始处理，格式同ffmpeg的-ss，默认：0
-interval   <number>    截取视频画面的两帧之间的间距，单位秒，默认：5
-sh         <number>    要截取的字幕区域占画面高度的比例，取值 0.0（不含） ~ 1.0（含），默认：0.1666
-font       <string>    字体文件路径，非windows下使用时必传，默认：c:/Windows/Fonts/msyh.ttc（微软雅黑）
-h                      显示这个帮助信息
-debug                  是否开启debug模式，打印更详细的日志
`;
    console.log(msg);
}

let videoFormat = ['mp4', 'avi', 'mov', 'mkv', 'wmv', 'flv', 'm4v', 'mpg', 'mpeg', '3gp', 'ts', 'webm', 'mpv'];
function isVideo(filepath) {
    return videoFormat.includes(path.extname(filepath).substring(1).toLowerCase());
}

function getDrawtextFilter(text) {
    //字体为视频高度的百分比
    let fontsizeRatio = maxLineNum + 1;
    return `drawtext=text='${text}':fontsize=h/${fontsizeRatio}:fontcolor=white:x=(w-tw)/2:y=(h-th)/2:fontfile='${fontfile}':borderw=2:text_align=center+middle`;
}

async function getTextLines(textfile) {
    let text = fs.readFileSync(textfile).toString();
    let lines = text.replace(/\r/g, '').split(/[\n]{2,}/img).filter(i => i != null && (maxLineNum = Math.max(maxLineNum, i.trim().split('\n').length), i.trim().length > 0));
    return lines;
}

async function makeImage(input, lines, startPosition, interval, size, output) {
    let cmd = 'ffmpeg';
    let filter_complex = '';
    let lineIndex = 0;
    let trim = 0;
    //[p0][p1][p2][p3]...[pn]
    let outputChain = new Array(lines.length + 1).fill(0).map((v, i) => `[p${i}]`).join('');
    filter_complex += `[0:v]crop=w=iw:h=ih-ih*${cropH}:x=0:y=0,trim=${trim}:duration=0.01,setpts=PTS-STARTPTS[p0];`;
    for (let i = 0; i < lines.length; i++) {
        lineIndex++;
        let line = lines[i];
        filter_complex += `[0:v]trim=${trim}:duration=0.01,setpts=PTS-STARTPTS,crop=w=iw:h=ih*${cropH}:x=0:y=ih-oh,${getDrawtextFilter(line)}[p${lineIndex}];`;
        trim += interval;
    }

    filter_complex += `${outputChain}vstack=${lines.length + 1}:shortest=1,scale=-2:${size}`;
    let args = [
        '-y', '-hide_banner', '-ss', startPosition, '-i', input,
        '-filter_complex', filter_complex,
        '-frames:v', '1',
        output
    ];
    if (debug) {
        console.log(cmd, args.map(i => i.includes(' ') ? `"${i}"` : i).join(' '));
    }
    await new Promise((resolve, reject) => {
        let p = child_process.execFile(cmd, args, {});
        p.on('exit', (code) => {
            if (process.stdin.isTTY) {
                process.stdout.write('\n');
            }
            resolve(code);
        });
        p.stderr.on('data', (chunk) => {
            if (debug) {
                if (!process.stdin.isTTY) {
                    console.log(chunk + '');
                } else {
                    process.stdout.write(chunk);
                }
            }
        });
    });
}

let debug = false;

// 拼接字幕的视频高度
let cropH = 1 / 6;
// 绘制的文本最大的行数
let maxLineNum = 1;

let fontfile = 'c:/Windows/Fonts/msyh.ttc';

async function start(args) {
    if (args == null) {
        args = parseArgs(process.argv.slice(2));
    }
    let input = args.i;
    let textfile = args.t;
    if (input == null || textfile == null || !!args.h) {
        showCmdHelp();
        return;
    }
    if (!fs.existsSync(input)) {
        console.log('输入文件不存在', input);
        return;
    }
    if (!isVideo(input)) {
        console.log('输入文件不是视频文件', input);
        return;
    }
    if (!fs.existsSync(textfile)) {
        console.log('字幕文件不存在', textfile);
        return;
    }
    let overwrite = !!args.y;
    debug = !!args.debug;
    let size = parseNumber(args.size, 400);
    let startPosition = args.ss || '0';
    let interval = parseNumber(args.interval, 5);
    let sh = parseNumber(args.sh, cropH);
    if (sh <= 0 || sh > 1) {
        sh = cropH;
    }
    cropH = sh;
    let fontPath = path.resolve(args.font || fontfile);
    if (!fs.existsSync(fontPath)) {
        console.log('字体文件不存在', fontPath);
        return;
    }
    fontfile = fontPath.replace(/\\/g, '/');
    let lines = await getTextLines(textfile);
    if (lines.length == 0) {
        console.log('字幕文件内容不能为空！');
        return;
    }
    let output = args.o || path.join(path.dirname(input), path.basename(input, path.extname(input)) + '_subtitle.jpg');
    if (!overwrite && fs.existsSync(output)) {
        console.log('输出文件已存在，跳过', output);
        return;
    }
    let startTime = Date.now();
    await makeImage(input, lines, startPosition, interval, size, output);
    console.log('输出文件：', output);
    console.log(`处理完毕，耗时: ${(Date.now() - startTime) / 1000}s`);
}

module.exports = { start }
if (process.argv[1] == __filename) {
    start();
}