
const fs = require('fs');
const path = require('path');
const child_process = require('child_process');

/**
 * 
 * @param {number[]|Uint8Array} buffers 
 * @param {16|2} radix 
 * @returns 
 */
function bin2str(buffers, radix = 16) {
    if (radix != 16 && radix != 2) throw new Error('radix must be 16 or 2');
    let padNum = radix == 16 ? 2 : 8;

    let list = [];
    buffers.forEach(i => list.push(i.toString(radix).padStart(padNum, '0').toUpperCase()));
    return list.join('')
}

function file2hexstr(filepath) {
    return new Promise((resolve, reject) => {
        fs.readFile(filepath, (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(bin2str(data));
            }
        });
    });
}

const regex = /(\w+): *([^ ]+)/g;
function parseShowinfo(input) {
    let index = input.indexOf('[Parsed_showinfo');
    let hasKey = input.indexOf('pts_time') > 0;
    if (index >= 0 && hasKey) {
        let line = index == 0 ? input : input.substring(index);
        let result = {};
        let match;
        while ((match = regex.exec(line)) !== null) {
            result[match[1]] = match[2];
        }
        return result;
    }
    return null;
}

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

async function makePbfContent(infoList, tempDir) {
    let pbfContent = '[Bookmark]\r\n';
    let bookmarkIndex = 0;
    for (let i = 0; i < infoList.length; i++) {
        let info = infoList[i];
        let { n, pts_time } = info;
        let millseconds = Math.round(pts_time * 1000);
        let imgFile = `${tempDir}/preview${(i + 1).toString().padStart(5, '0')}.jpg`;
        if (fs.existsSync(imgFile)) {
            let hexstr = await file2hexstr(imgFile);
            let title = '书签 ' + (bookmarkIndex + 1);
            pbfContent += `${bookmarkIndex}=${millseconds}*${title}*2800000048000000480000000100200004000000${millseconds.toString().padStart(48, '0')}${hexstr}\r\n`;
            bookmarkIndex++;
        } else {
            console.log('书签图片不存在', imgFile);
        }
    }
    pbfContent += `${bookmarkIndex}=\r\n\r\n`;
    return pbfContent;
}

async function getSceneByFfmpeg(video, tempDir, height = 72, sceneScore = 0.5, minInterval = 20, maxInterval = 60,) {
    let cmd = 'ffmpeg';
    let args = [
        '-y', '-hide_banner', '-i', video,
        // '-filter_complex', `select='gt(scene\\,${sceneScore})*eq(pict_type\\,I)',scale=-2:${height},showinfo=checksum=0`,
        '-filter_complex', `select='(isnan(prev_selected_t)+gte(t-prev_selected_t,${minInterval}))*(gt(scene,${sceneScore})*eq(pict_type,I)+eq(mod(t,${maxInterval}),0))',scale=-2:${height},showinfo=checksum=0`,
        '-vsync', 'vfr',//-vsync -fps_mode,使用 -vsync 兼容老版本ffmpeg（4.4）
        `${tempDir}/preview%5d.jpg`
    ];
    if (debug) {
        console.log(cmd, args.map(i => i.includes(' ') ? `"${i}"` : i).join(' '));
    }
    let output = '';
    let offset = 0;
    let infoList = [];
    let duration = -1;
    let progressPosition = 0;
    await new Promise((resolve, reject) => {
        let p = child_process.execFile(cmd, args, {});
        p.on('exit', (code) => {
            if (process.stdin.isTTY) {
                process.stdout.write('\n');
            }
            resolve(code);
        });
        p.stderr.on('data', (chunk) => {
            output += chunk + '';
            while (true) {
                let index = output.indexOf('\n', offset);
                if (index == -1) {
                    break;
                }
                let line = output.substring(offset, index);
                if (duration == -1) {
                    let maybeDuration = tryParseDuration(line);
                    if (maybeDuration != null) {
                        duration = maybeDuration;
                    }
                }
                let progress = tryParseProgress(line);
                if (progress != null) {
                    progressPosition = progress.time;
                }
                offset = index + 1;
                let info = parseShowinfo(line);
                if (info != null) {
                    infoList.push(info);
                }
                let progressStr = duration != null && progressPosition != 0 ? `，解析进度：${(progressPosition / duration * 100).toFixed(2)}%` : '';
                let msg = `解析到场景数：${infoList.length}${progressStr}`;
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
    return infoList;
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

async function test() {
    let video = "";
    let tempDir = '';
    let infoList = await getSceneByFfmpeg(video, tempDir, 72, 0.5);
    console.log(infoList.length, infoList.map(i => JSON.stringify(i)).join('\n'));

    let pbfContent = await makePbfContent(infoList, tempDir);
    let pbfFile = path.join(path.dirname(video), path.basename(video, path.extname(video)) + '.pbf');
    fs.writeFileSync(pbfFile, pbfContent);
    console.log('END');
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

function getAllVideoFile(dir) {
    let list = fs.readdirSync(dir, { withFileTypes: true });
    let rs = [];
    for (const item of list) {
        let fullpath = path.join(dir, item.name);
        if (item.isFile()) {
            if (isVideo(fullpath)) {
                rs.push(fullpath);
            }
        } else if (item.isDirectory()) {
            let sublist = getAllVideoFile(fullpath);
            rs.push(...sublist);
        }
    }
    return rs;
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
    let tempDir = args.temp || path.join(__dirname, 'temp');
    let overwrite = !!args.y;
    debug = !!args.debug;
    let height = parseNumber(args.size, 72);
    let score = parseNumber(args.score, 0.5);
    let minInterval = parseNumber(args['min-interval'], 20);
    let maxInterval = parseNumber(args['max-interval'], 60);
    minInterval = Math.max(minInterval, 1);
    maxInterval = Math.max(maxInterval, minInterval);
    fs.mkdirSync(tempDir, { recursive: true });
    let stat = fs.statSync(input);
    let filelist = [];
    if (stat.isDirectory()) {
        filelist = getAllVideoFile(input);
    } else {
        if (isVideo(input)) {
            filelist.push(input);
        }
    }
    if (filelist.length == 0) {
        console.log('没有找到视频文件');
        return;
    }
    for (let i = 0; i < filelist.length; i++) {
        const videoFile = filelist[i];
        // pbf文件与视频文件同目录
        let pbfFile = path.join(path.dirname(videoFile), path.basename(videoFile, path.extname(videoFile)) + '.pbf');
        if (overwrite == false && fs.existsSync(pbfFile)) {
            console.log('pbf文件已存在，跳过', pbfFile);
            continue;
        }
        console.log('开始处理:', i + 1, '/', filelist.length, videoFile);
        let infoList = await getSceneByFfmpeg(videoFile, tempDir, height, score, minInterval, maxInterval);
        let pbfContent = await makePbfContent(infoList, tempDir);
        fs.writeFileSync(pbfFile, pbfContent);
        console.log('处理完毕:', videoFile);
    }
    console.log('所有文件处理完毕，即将退出');
}

module.exports = { start }

// test();
if (process.argv[1] == __filename) {
    start();
}