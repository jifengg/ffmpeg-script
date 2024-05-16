
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
    let msg = `${process.argv.slice(0, 2).join(' ')} -i <folder> [-o <file> ...]
-i              <string>    [必须]图片所在的目录
 -duration      <number>    每张图片从出现到消失的时长（秒），默认：20
 -direction     <string>    图片滚动的方向，可选：rl（从右到左，默认），lr（从左到右）
 -margin        <number[|number[|number|number]]>
                            图片之间的间距，支持的格式：all、vertical|horizontal、top|right|bottom|left，默认all=20
-o              <string>    输出视频的路径，默认为输入目录下的output.mp4
 -fps           <number>    输出视频的帧率，默认：25
-y                          是否覆盖已经存在的输出文件，默认：false
-bgimage        <string>    背景图片的路径，比bgcolor优先，默认：无
 -blursigma     <number>    背景图片虚化的sigma值，为0表示不虚化，默认：15
-bgcolor        <string>    背景颜色，值的格式同ffmpeg的color，默认：black
-width          <number>    输出视频的宽度，默认：1920
-height         <number>    输出视频的高度，默认：1080
-top            <number>    图片区距离视频顶部的距离，默认：0
-bottom         <number>    图片区距离视频底部的距离，默认：0
-title          <string>    视频的标题，显示在画面上方，默认：无
 -tsize         <number>    标题文字大小，默认：80
 -tcolor        <string>    标题文字颜色，值的格式同ffmpeg的color，默认：white
 -tbordercolor  <string>    标题边框颜色，值的格式同ffmpeg的color，默认：black
 -tfont         <string>    标题字体文件路径，非windows下使用时必传，默认：c:/Windows/Fonts/msyh.ttc（微软雅黑）
-footer         <string>    视频的底部文字（脚注），显示在画面下方，默认：无
 -fsize         <number>    脚注文字大小，默认：30
 -fcolor        <string>    脚注文字颜色，值的格式同ffmpeg的color，默认：white
 -fbordercolor  <string>    脚注边框颜色，值的格式同ffmpeg的color，默认：black
 -ffont         <string>    脚注字体文件路径，非windows下使用时必传，默认：c:/Windows/Fonts/msyh.ttc（微软雅黑）
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

function getAllImageFile(dir) {
    let list = fs.readdirSync(dir, { withFileTypes: true });
    let rs = [];
    for (const item of list) {
        let fullpath = path.join(dir, item.name);
        if (item.isFile()) {
            if (isImage(fullpath)) {
                rs.push(fullpath);
            }
        } else if (item.isDirectory()) {
            let sublist = getAllVideoFile(fullpath);
            rs.push(...sublist);
        }
    }
    return rs;
}

function getDrawtextFilter(text, size, color, bordercolor, fontfile, istitle) {
    text = text.replace(/\\n/img, '\n');
    return `drawtext=text=${text}:fontsize=${size}:fontcolor=${color}:bordercolor=${bordercolor}:borderw=2:x=(w-tw)/2:y=${istitle ? size / 2 : `h-th-${size / 2}`}:fontfile='${fontfile}'`;
}

let debug = false;
let defaultFontfile = 'c:/Windows/Fonts/msyh.ttc';

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
        console.log('输入文件夹不存在', input);
        return;
    }
    let overwrite = !!args.y;
    debug = !!args.debug;
    let width = parseNumber(args.width, 1920);
    let height = parseNumber(args.height, 1080);
    let top = parseNumber(args.top, 0);
    let bottom = parseNumber(args.bottom, 0);
    let oneDuration = parseNumber(args.duration, 20);
    oneDuration = Math.max(1, oneDuration);

    let images = getAllImageFile(input);
    if (images.length == 0) {
        console.log('没有找到图片文件');
        return;
    }
    let outputVideo = args.o || path.join(input, 'output.mp4');
    if (fs.existsSync(outputVideo) && !overwrite) {
        console.log('输出文件已存在', outputVideo);
        return;
    }
    let direction = args.direction == 'lr' ? 'lr' : 'rl';
    let bgimage = args.bgimage;
    let bgcolor = args.bgcolor || 'black';
    let blursigma = parseNumber(args.blursigma, 15);
    let title = args.title;
    let titlefontSize = parseNumber(args.tsize, 80);
    let titlecolor = args.tcolor || 'white';
    let titlebordercolor = args.tbordercolor || 'black';
    let titlefontPath = path.resolve(args.tfont || defaultFontfile);
    if (title && !fs.existsSync(titlefontPath)) {
        console.log('字体文件不存在', titlefontPath);
        return;
    }
    titlefontPath = titlefontPath.replace(/\\/g, '/');
    let titleHeight = top;//+ title ? titlefontSize * 2 : 0;

    let footer = args.footer;
    let footerfontSize = parseNumber(args.fsize, 30);
    let footercolor = args.fcolor || 'white';
    let footerbordercolor = args.fbordercolor || 'black';
    let footerfontPath = path.resolve(args.ffont || defaultFontfile);
    if (footer && !fs.existsSync(footerfontPath)) {
        console.log('字体文件不存在', footerfontPath);
        return;
    }
    footerfontPath = footerfontPath.replace(/\\/g, '/');
    let footerHeight = bottom;//+ footer ? footerfontSize * 2 : 0;

    let leftMargin = 0;
    let topMargin = 0;
    let rightMargin = 0;
    let bottomMargin = 0;
    let marginStr = args.margin || '20';
    if (/^\d+$/.test(marginStr)) {
        leftMargin = rightMargin = topMargin = bottomMargin = parseNumber(marginStr, 0);
    } else if (/^\d+\|\d+$/.test(marginStr)) {
        let [v, h] = marginStr.split('|');
        leftMargin = rightMargin = parseNumber(h, 0);
        topMargin = bottomMargin = parseNumber(v, 0);
    } else if (/^\d+\|\d+\|\d+\|\d+$/.test(marginStr)) {
        let [t, r, b, l] = marginStr.split('|');
        leftMargin = parseNumber(l, 0);
        rightMargin = parseNumber(r, 0);
        topMargin = parseNumber(t, 0);
        bottomMargin = parseNumber(b, 0);
    } else {
        console.log('margin参数设置无效：“', marginStr, '”，将使用默认值0');
    }

    let fps = parseNumber(args.fps, 25);

    let startTime = Date.now();
    console.log('开始处理。');
    console.log(
        `输入目录：${input}
图片数量：${images.length}
视频分辨率：${width}x${height}`);
    let cmd = 'ffmpeg';
    let filter_complex = '';
    let duration = oneDuration * images.length;
    let bginputs = [];
    if (bgimage != null) {
        bginputs = [...'-loop 1 -r 1/1000 -i'.split(' '), bgimage];
    } else {
        bginputs = [...'-f lavfi -t 1 -r 1/1000 -i'.split(' '), `color=c=${bgcolor}:s=${width}x${height}`];
    }
    let imageInputs = [];
    for (let i = 0; i < images.length; i++) {
        imageInputs.push('-i', images[i]);
    }
    filter_complex += `[0:v]${bgimage ? `gblur=sigma=${blursigma},scale=${width}:${height},` : ''}`
        + `${title ? getDrawtextFilter(title, titlefontSize, titlecolor, titlebordercolor, titlefontPath, true) + ',' : ''}`
        + `${footer ? getDrawtextFilter(footer, footerfontSize, footercolor, footerbordercolor, footerfontPath, false) + ',' : ''}`
        + `fps=${fps},trim=duration=${duration}[v0];`;
    let imageHeight = height - footerHeight - titleHeight;
    for (let i = 0; i < images.length; i++) {
        filter_complex += `[${i + 1}:v]scale=-2:${imageHeight}-${topMargin + bottomMargin},`
            + `pad=iw+${leftMargin + rightMargin}:h=ih+${topMargin + bottomMargin}:x=${leftMargin}:y=${topMargin}:color=black@0[v${i + 1}];`;
    }
    let speed = `((W+w)/${duration})`;
    let xStep = direction == 'rl' ? `W-t*${speed}` : `t*${speed}-w`;
    filter_complex += `${new Array(images.length).fill(0).map((v, i) => `[v${i + 1}]`).join('')}hstack=inputs=${images.length}[fg];`
        + `[v0][fg]overlay=x=${xStep}:y=${titleHeight}`;
    let ffmpeg_args = [
        '-y', '-hide_banner',
        ...bginputs, ...imageInputs,
        '-filter_complex', filter_complex,
        // 输出视频的一些参数，这里只用了质量控制参数 -crf 23，可自行添加如 -c:v libx265 等
        '-crf', '23',
        outputVideo
    ];
    if (debug) {
        console.log(cmd, ffmpeg_args.map(i => i.includes(' ') ? `"${i}"` : i).join(' '));
    }
    let output = '';
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
                let progress = tryParseProgress(line);
                if (progress != null) {
                    progressPosition = progress.time;
                } else {
                    continue;
                }
                if (isNaN(progressPosition)) {
                    continue;
                }
                let progressStr = duration != null && progressPosition != 0 ? `处理进度：${(progressPosition / 1000).toFixed(2).padStart(7, ' ')} 秒（${(progressPosition / 1000 / duration * 100).toFixed(2).padStart(5, ' ')}%）` : '';
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

module.exports = { start }

if (process.argv[1] == __filename) {
    start();
}