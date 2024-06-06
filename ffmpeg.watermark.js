
const fs = require('fs');
const path = require('path');
const child_process = require('child_process');

let boolArgsKey = [
    'y', 'h', 'v', 'debug', 'repeat',
]

let groupArgsKey = [
    'fontsize', 'fontcolor', 'fontfile', 'fontborderwidth', 'fontbordercolor',
    'alpha', 'left', 'top', 'right', 'bottom',
    'move', 'xspeed', 'yspeed', 'interval', 'seed', 'xstart', 'ystart',
    'repeat', 'boxw', 'boxh', 'rotate',
    'scale',
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
        // 兼容传负数值类似  -2 或 -1:100 等情况，减号后面跟着数字则认为是“值”而不是“key”
        if (v.startsWith('-') && (v.length > 1 && isNaN(Number(v[1])))) {
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
                    if (key == 'preset') {
                        let params = loadPreset(v);
                        args.splice(i + 1, 0, ...params);
                    }
                }
                key = null;
            } else {
                rs._.push(v);
            }
        }
    }
    return rs;
}

function loadPreset(filepath = '') {
    let exist = true;
    if (!fs.existsSync(filepath)) {
        // 如果路径不含文件路径分隔符，则尝试在指定目录中查找
        if (!path.normalize(filepath).includes(path.sep)) {
            filepath = path.join('preset', filepath);
            // 再加上后缀试试
            if (!fs.existsSync(filepath)) {
                filepath = `${filepath}.preset`;
                exist = fs.existsSync(filepath);
            }
        } else {
            exist = false;
        }
    }
    if (!exist) {
        throw `预设置文件不存在：${filepath}`;
    }
    let lines = fs.readFileSync(filepath).toString().replace(/\r/g, '').split('\n');
    // 移除lines中的空白行，并去除每行前后的空格。#开头的为注释行，也忽略
    lines = lines.filter(line => line.trim().length > 0 && !line.startsWith('#') && !line.startsWith('//')).map(line => line.trim());
    return lines;
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
    let msg = `${process.argv.slice(0, 2).join(' ')} -i <file|folder> [-o <file|folder> ...]
-preset         <string>    本脚本除了-preset之外的所有参数，均可以通过传递preset文件来设置。
                            如果使用./preset/abc.preset来设置，则-preset abc即可。
                            preset文件的编写请参考github（https://github.com/jifengg/ffmpeg-script）。                            
-i              <string>    [必须]要处理的文件或目录
-y                          是否覆盖已经存在的pbf文件，默认：false
-h                          显示这个帮助信息
-debug                      是否开启debug模式，打印更详细的日志
-[text|file]    <string>    [必须]水印的文本内容或文件路径，必须至少传一组。
                            与ffmpeg参数传递规则类似，水印有很多可定义的参数，且支持传多个水印。
                            因此，-text/file之前的参数是用来设置这一组水印信息的，之后的参数是下一组水印的。
                            如：-fontsize 30 -text 此水印字号为30 -fontsize 40 -text 此水印字号为40
-text           <string>    水印的文本内容
  -fontsize     <number>    文字的字号，默认：20
  -fontcolor    <string>    文字颜色，值的格式同ffmpeg的color，默认：white
  -fontborderwidth
                <number>    文字边框大小，单位像素，默认：0
  -fontbordercolor
                <string>    文字边框颜色，值的格式同ffmpeg的color，默认：black
  -fontfile     <string>    文字字体文件路径，非windows下使用时必传，默认：c:/Windows/Fonts/msyh.ttc（微软雅黑）
-file           <string>    水印文件的路径，支持视频或图片
  -scale        <string>    水印文件的缩放尺寸，值的格式同ffmpeg的scale过滤器。如“1920:1080”
-alpha          <number>    水印的透明度，取值范围：0.0 - 1.0，默认：1.0[完全不透明]
-[left|right|top|bottom]
                <number>    水印的左、右、上、下边距。默认：right=20，top=20
                            当值≤1.0时，表示整个画面的百分比，也就是说left=0.5时表示在画面水平居中
                            当值>1.0时，表示像素值，如left=200表示距离画面左边200像素。
                            如果你要定义1像素，请使用“1.1”
-move           <string>    水印的移动方式，可选：dvd、random；默认不移动
  -xspeed       <number>    move=dvd时生效。表示每秒水平移动的像素。默认：400
  -yspeed       <number>    move=dvd时生效。表示每秒垂直移动的像素。默认：300
  -xstart       <number>    move=dvd时生效。表示初始水平位置。默认：0
  -ystart       <number>    move=dvd时生效。表示初始垂直位置。默认：0
  -interval     <number>    move=random时生效。表示多少秒变换一个位置。默认：10
  -seed         <number>    move=random时生效。表示随机数种子。不传则随机生成
-repeat                     是否用水印重复填充整个画面，默认：false
  -boxw         <number>    启用填充时，每个水印的宽度，如果水印是-file，则不能小于-scale的宽度，默认：200
  -boxh         <number>    启用填充时，每个水印的高度，如果水印是-file，则不能小于-scale的高度，默认：100
  -rotate       <number>    启用填充时，每个水印的旋转角度，注意是角度而不是弧度，默认：0
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

function getRepeatFilter(boxw, boxh, rotate, inputFilterName, sourceIndex) {
    let colNum = Math.max(2, Math.ceil(8000 / boxw));
    let rowNum = Math.max(2, Math.ceil(6000 / boxh));
    let colOutput = new Array(colNum).fill(0).map((v, i) => `[col_${sourceIndex}_${i}]`).join('');
    let rowOutput = new Array(rowNum).fill(0).map((v, i) => `[row_${sourceIndex}_${i}]`).join('');
    return `split=${colNum}${colOutput};`
        + `${colOutput}hstack=inputs=${colNum},split=${rowNum}${rowOutput};`
        + `${rowOutput}vstack=inputs=${rowNum},rotate=${rotate}*PI/180:fillcolor=black@0[overlay_${sourceIndex}];`
        + `${inputFilterName}[overlay_${sourceIndex}]overlay=(W-w)/2:(H-h)/2`;
}

let debug = false;
let defaultFontfile = 'c:/Windows/Fonts/msyh.ttc';

let moveType_DVD = 'dvd';
let moveType_RANDOM = 'random';

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
        let moveType = group.move || null;
        // 如果不是视频则不需要移动
        if (!isvideo) {
            moveType = null;
        }
        let xMax = group.text ? 'w-tw' : 'W-w';
        let yMax = group.text ? 'h-th' : 'H-h';
        let xexp = '';
        let yexp = '';
        let repeat = !!group.repeat;
        // 如果需要重复填充，则认为是不需要移动的
        if (repeat) {
            xexp = `(${xMax})/2`;
            yexp = `(${yMax})/2`;
        } else {
            switch (moveType) {
                case moveType_DVD:
                    let xspeed = parseNumber(group.xspeed, 400);
                    let yspeed = parseNumber(group.yspeed, 300);
                    let xstart = parseNumber(group.xstart, 0);
                    let ystart = parseNumber(group.ystart, 0);
                    xexp = `abs(mod(t*${xspeed}+(${xMax})+${xstart},(${xMax})*2)-(${xMax}))`;
                    yexp = `abs(mod(t*${yspeed}+(${yMax})+${ystart},(${yMax})*2)-(${yMax}))`;
                    break;
                case moveType_RANDOM:
                    // 变化间隔，单位秒
                    let interval = parseNumber(group.interval, 10);
                    let seed = parseNumber(group.seed, Math.random() * 9e4 + 1e4);
                    // t是时间，将它除以变化间隔后取整则可以保证在变化间隔内计算式都是同样的值，看起来就是间隔内没有移动。
                    // 随机移动采用一个取巧的方式。因为ffmpeg的random函数需要设置seed，相同的seed出来的随机数是一样的，但是在计算式之间没法共享seed。
                    // 因此，x轴使用平方函数，且基数较大，这样在相差1的时候平方值也会有较大的幅度。
                    // y轴使用一个正弦函数，并随机一个初始弧度。x，y
                    // xexp = `abs(mod(floor(t/${interval})*${seed}+(${xMax}),(${xMax})*2)-(${xMax}))`;
                    // yexp = `abs(mod(floor(t/${interval})*${seedy}+(${yMax}),(${yMax})*2)-(${yMax}))`;
                    xexp = `mod(pow(${seed}+floor(t/${interval}),2),(${xMax}))`;
                    // yexp = `mod(pow(${seedy}+floor(t/${interval}),2),(${yMax}))`;
                    // xexp = `(sin(floor(t/${interval})*${seedx})+1)/2*(${xMax})`;
                    yexp = `(sin(floor(t/${interval})+${seed})+1)/2*(${yMax})`;
                    break;
                default:
                    xexp = right == null ? (left > 1 ? left : `(${xMax})*${left}`) : (right > 1 ? `${xMax}-${right}` : `(${xMax})*${1 - right}`);
                    yexp = bottom == null ? (top > 1 ? top : `(${yMax})*${top}`) : (bottom > 1 ? `${yMax}-${bottom}` : `(${yMax})*${1 - bottom}`);
                    break;
            }
        }
        let boxw = parseNumber(group.boxw, 200);
        let boxh = parseNumber(group.boxh, 100);
        let rotate = parseNumber(group.rotate, 0);
        if (group.text) {
            // 文字。文字直接绘制在源画面上
            let text = group.text.replace(/\\n/g, '\n');
            let fontsize = parseNumber(group.fontsize, 20);
            let fontcolor = group.fontcolor || 'white';
            let fontfile = path.resolve(group.fontfile || defaultFontfile);
            let fontBorderWidth = parseNumber(group.fontborderwidth, 0);
            let fontBorderColor = group.fontbordercolor || 'black';
            if (!fs.existsSync(fontfile)) {
                console.error('字体文件不存在', fontfile);
                return;
            }
            fontfile = fontfile.replace(/\\/g, '/');
            let drawtextFilter = `drawtext=text='${text}':fontsize=${fontsize}:fontcolor=${fontcolor}@${alpha}:`
                + `x='${xexp}':`
                + `y='${yexp}':`
                + `fontfile='${fontfile}':`
                + `borderw=${fontBorderWidth}:bordercolor=${fontBorderColor}@${alpha}:text_align=center+middle`;
            if (repeat) {
                // 要重复填充，文本需要一个空白的画布，而不是在画面上直接写。
                sourceinputs.push(...`-f lavfi -r 1 -t 1 -i color=s=${boxw}x${boxh}`.split(' '));
                filter_complex += `[${sourceIndex}:v]format=argb,colorchannelmixer=aa=0,${drawtextFilter},`
                    + getRepeatFilter(boxw, boxh, rotate, inputFilterName, sourceIndex)
                    + `${outputFilterName};`;
                sourceIndex++;
            } else {
                filter_complex += `${inputFilterName}${drawtextFilter}${outputFilterName};`;
            }
            inputFilterName = outputFilterName;
        } else if (group.file) {
            let file = group.file;
            if (!fs.existsSync(file)) {
                console.error('-file 文件不存在', file);
                return;
            }
            // 图片或视频
            sourceinputs.push('-i', file);
            let scale = group.scale;
            let sourceFilterName = `[${sourceIndex}:v]`;
            if (scale || alpha != 1) {
                let filterName = `[v_p_${sourceIndex}]`;
                let preProcessArr = [];
                if (scale) {
                    preProcessArr.push(`scale=${scale}`);
                }
                if (alpha != 1) {
                    preProcessArr.push(`format=argb,colorchannelmixer=aa=${alpha}`);
                }
                filter_complex += `${sourceFilterName}${preProcessArr.join(',')}${filterName};`;
                sourceFilterName = filterName;
            }
            if (repeat) {
                filter_complex += `${sourceFilterName}pad=${boxw}:${boxh}:(ow-iw)/2:(oh-ih)/2:color=black@0,`
                    + getRepeatFilter(boxw, boxh, rotate, inputFilterName, sourceIndex)
                    + `${outputFilterName};`;
            } else {
                filter_complex += `${inputFilterName}${sourceFilterName}overlay=x='${xexp}':y='${yexp}'${outputFilterName};`;
            }
            inputFilterName = outputFilterName;
            sourceIndex++;
        }
    }

    let crf = parseNumber(args.crf, 23);
    let fps = parseNumber(args.fps, null);

    // 移除最后一个输出，如[v12];
    filter_complex = filter_complex.substring(0, filter_complex.length - 1 - outputFilterName.length);

    let ffmpeg_args = [
        '-y', '-hide_banner',
        '-i', input,
        ...sourceinputs,
        '-filter_complex', filter_complex,
        // 输出视频的一些参数，这里只用了质量控制参数 -crf 23，可自行添加如 -c:v libx265 等
        ...(isvideo ? ['-shortest', '-crf', crf,] : ['-frames:v', '1']),
        ...(fps != null ? ['-r', fps] : []),
        outputfile
    ];
    if (debug) {
        console.log(cmd, ffmpeg_args.map(i => i.toString().includes(' ') ? `"${i}"` : i).join(' '));
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
    console.log('处理完毕。耗时：', processTime / 1000, '秒', '保存文件：', outputfile);
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
    input = path.resolve(input);
    if (!fs.existsSync(input)) {
        console.error('输入文件（夹）不存在', input);
        return;
    }
    if (args.__groups.length == 0) {
        console.error('未设置', groupArgsEndKey.join('、'), '参数');
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
    // 如果输入文件超过1个，则输出必须是一个目录
    if (filelist.length > 1 && args.o) {
        let output = path.resolve(args.o.trim());
        if (fs.existsSync(output)) {
            if (!fs.statSync(output).isDirectory()) {
                console.error('同时处理多个文件时，-o 必须是一个目录', output);
                return;
            }
        } else {
            fs.mkdirSync(output, { recursive: true });
        }
    }
    // 遍历文件列表
    for (let i = 0; i < filelist.length; i++) {
        let inputfile = filelist[i];
        let output = args.o || path.dirname(inputfile);
        output = path.resolve(output);
        if (fs.existsSync(output) && fs.statSync(output).isDirectory()) {
            output = path.join(output, path.basename(inputfile, path.extname(inputfile)) + '_watermark' + path.extname(inputfile));
        }
        if (!overwrite && fs.existsSync(output)) {
            console.log('输出文件已存在，跳过', output);
            continue;
        }
        fs.mkdirSync(path.dirname(output), { recursive: true });
        console.log('开始处理：[', i + 1, '/', filelist.length, ']', inputfile);
        await addWatermark(inputfile, output, args);
    }
    console.log('全部处理完成。即将退出脚本。');
}

module.exports = { start }

process.on('uncaughtException', (err) => {
    console.error(err);
});
process.on('unhandledRejection', (err) => {
    console.error(err);
});

// test();
if (process.argv[1] == __filename) {
    start();
}