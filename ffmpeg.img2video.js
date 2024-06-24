const child_process = require('child_process');
const fs = require('fs');
const path = require('path');

let transitions = [
    // 'custom',
    'fade',
    'wipeleft',
    'wiperight',
    'wipeup',
    'wipedown',
    'slideleft',
    'slideright',
    'slideup',
    'slidedown',
    'circlecrop',
    'rectcrop',
    'distance',
    'fadeblack',
    'fadewhite',
    'radial',
    'smoothleft',
    'smoothright',
    'smoothup',
    'smoothdown',
    'circleopen',
    'circleclose',
    'vertopen',
    'vertclose',
    'horzopen',
    'horzclose',
    'dissolve',
    'pixelize',
    'diagtl',
    'diagtr',
    'diagbl',
    'diagbr',
    'hlslice',
    'hrslice',
    'vuslice',
    'vdslice',
    'hblur',
    'fadegrays',
    'wipetl',
    'wipetr',
    'wipebl',
    'wipebr',
    'squeezeh',
    'squeezev',
    // 'zoomin',
    'fadefast',
    'fadeslow',
    'hlwind',
    'hrwind',
    'vuwind',
    'vdwind',
    'coverleft',
    'coverright',
    'coverup',
    'coverdown',
    'revealleft',
    'revealright',
    'revealup',
    'revealdown',
];


let boolArgsKey = [
    'y', 'h', 'v', 'debug', 'repeat',
]

let groupArgsKey = [];

let groupArgsEndKey = [];

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

/**
 * 获取媒体文件的时长
 * @param {string} filepath 
 * @returns {number} 如果能获取到时长，则返回毫秒，否则返回null
 */
async function getMediaDuration(filepath) {
    let cmd = 'ffmpeg';
    let args = ['-hide_banner', '-i', filepath];
    return await new Promise((resolve, reject) => {
        let p = child_process.execFile(cmd, args, {}, function (err, stdout, stderr) {
            if (stderr != null) {
                resolve(tryParseDuration(stderr));
            } else {
                resolve(null);
            }
        });
    });
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

let Display = {
    Contain: 'contain',
    Original: 'original',
    Cover: 'cover',
    Fill: 'fill'
}

function showCmdHelp() {
    let msg = `${process.argv.slice(0, 2).join(' ')} -i <folder> [-o <file|folder> ...]
-preset     <string>    本脚本除了-preset之外的所有参数，均可以通过传递preset文件来设置。
                        如果使用./preset/abc.preset来设置，则-preset abc即可。
                        preset文件的编写请参考github（https://github.com/jifengg/ffmpeg-script）。                            
-i          <string>    [必须]要处理的图片或音频文件所在的目录
-o          <string>    视频文件的保存路径，默认为输入目录/output.mp4
 -display   <string>    图片的显示方式，默认为contain。可选值为：
                        original：原图；
                        contain：等比例缩放至显示全图，可能有黑边；
                        cover：等比例缩放至能覆盖整个画面，可能有裁剪。
                        fill:拉伸变形至填充整个画面
 -fps       <number>    输出视频的帧率，默认：25
 -crf       <number>    ffmpeg控制输出视频质量的参数，越小画面质量越好，视频文件也会越大，建议18~30之间。默认：23
 -c:v       <string>    输出视频的编码器，默认：h264
 -c:a       <string>    输出视频的音频编码器，默认：aac
 -width     <number>    输出视频的宽度，默认：1920
 -height    <number>    输出视频的高度，默认：1080
 -td        <number>    图片切换动画时长，默认为4秒
 -sd        <number>    图片独立显示时长，默认为7秒
 -repeat                图片数量太少导致视频时长比音频时长短的时候，循环图片以达到音频的时长。默认：不循环
-y                      覆盖已经存在的输出文件，默认：false
-h                      显示这个帮助信息
-debug                  开启debug模式，打印更详细的日志
`;
    console.log(msg);
}

/**
 * 
 * @param {{imgs:[string],audio_file:string,subtitle_file:string,output_file:string, width:number, height:number,showDuration:number,tranDuration:number,repeat:boolean,fps:number,crf:number}} param0 
 */
async function run({ imgs, audio_file, subtitle_file, output_file,
    width, height, showDuration, tranDuration, repeat, display,
    fps, crf, video_codec, audio_codec,
}) {
    let w = Math.floor((width || 1920) / 4) * 4;
    let h = Math.floor((height || (w * 9 / 16)) / 4) * 4;
    console.log('输出视频分辨率:', w, 'x', h);
    let cmd = 'ffmpeg';
    let args = ['-y', '-hide_banner'];
    let filters_lain = '';
    let lain_index = 0;
    let input_image_start_index = 0;
    let audio_duration = -1;
    if (audio_file) {
        //获取音频时长，单位秒
        audio_duration = await getMediaDuration(audio_file);
        if (audio_duration == null) {
            console.warn('音频文件读取失败，将忽略音频文件')
        } else {
            args.push('-i', audio_file);
            input_image_start_index++;
            audio_duration = audio_duration / 1000;
            console.log('音频时长:', audio_duration, '秒');
        }
    }
    //输入图片循环时长
    let loopDuration = showDuration + tranDuration * 2;
    let imgDuration = imgs.length * (showDuration + tranDuration);
    let duration = imgDuration;
    if (repeat && imgDuration < audio_duration) {
        //如果图片动画时长不够，则循环
        let toAdd = Math.ceil((audio_duration - imgDuration) / (showDuration + tranDuration));
        let i = 0;
        let list = [];
        console.log('图片数量不足，将循环补足', toAdd, '张');
        while (toAdd > 0) {
            list.push(imgs[i % imgs.length]);
            toAdd--;
            i++;
        }
        imgs.push(...list);
        duration = audio_duration;
    };
    console.log('图片数量', imgs.length);
    console.log('图片动画时长', tranDuration, '秒');
    console.log('图片独立显示时长', showDuration, '秒');
    console.log('输出视频时长为', duration, '秒');

    for (let i = 0; i < imgs.length; i++) {
        const img = imgs[i];
        args.push(
            '-loop', '1', '-r', `1/1000`, '-i', img
        );
        // filters_lain += `[${i}]setsar=1/1,scale=${w}:${h}[v${i}_${lain_index}];`;
        // force_original_aspect_ratio=decrease,increase
        // decrease: 保持宽高比，缩小图片，搭配pad做居中和黑边
        // increase: 保持宽高比，放大图片，搭配crop=1920:1080做裁剪
        let display_filter = '';
        switch (display) {
            case Display.Cover:
                display_filter = `scale=${w}:${h}:force_original_aspect_ratio=increase:force_divisible_by=4,crop=w=${w}:h=${h}`;
                break;
            case Display.Fill:
                display_filter = `scale=${w}:${h}`;
                break;
            case Display.Original:
                // 如果图片尺寸太大，则先裁剪。裁剪后放在视频画面大小的画板上居中
                display_filter = `crop=w='if(gt(iw,${w}),${w},iw)':h='if(gt(ih,${h}),${h},ih)',pad=w=${w}:h=${h}:x=(ow-iw)/2:y=(oh-ih)/2:color=black`;
                break;
            case Display.Contain:
            default:
                display_filter = `scale=${w}:${h}:force_original_aspect_ratio=decrease:force_divisible_by=4,pad=w=${w}:h=${h}:x=(ow-iw)/2:y=(oh-ih)/2:color=black`;
                break;
        }
        filters_lain += `[${i + input_image_start_index}]setsar=1/1,${display_filter},fps=${fps},trim=duration=${loopDuration}[v${i}_${lain_index}];`;
    }
    let last_output_label = `v0_${lain_index}`;
    for (let i = 1; i < imgs.length; i++) {
        let transition = getTransition();
        let duration = tranDuration;
        let offset = i * (showDuration + tranDuration) - tranDuration;
        let output_label = `ov${i}_${lain_index}`;
        filters_lain += `[${last_output_label}][v${i}_${lain_index}]xfade=transition=${transition}:duration=${duration}:offset=${offset}[${output_label}];`;
        last_output_label = output_label;
    }
    if (subtitle_file) {
        let output_label = 'ov_with_sub';
        filters_lain += `[${last_output_label}]subtitles=filename='${subtitle_file.replace(/\\/g, '/').replace(/:/g, '\\:')}'[${output_label}];`;
        last_output_label = output_label;
    }
    filters_lain = filters_lain.substring(0, filters_lain.length - 1 - last_output_label.length - 2);
    args.push(
        '-filter_complex', filters_lain
    );
    args.push(
        // '-map', `[${last_output_label}]`,
        //-keyint_min 30 -g 30 -sc_threshold 0 //设置i帧最小间距为30帧
        ...`-crf ${crf} -c:v ${video_codec} -pix_fmt yuv420p -movflags +faststart -r ${fps} -aspect ${w}:${h}`.split(' '),
    );
    args.push(
        ...`-c:a ${audio_codec} -b:a 128k -ac 2 -ar 44100`.split(' '),
    );
    args.push(
        '-t', duration + '', '-shortest', output_file
    )
    let line = [cmd, ...args].map(v => (v + '').includes(' ') ? `"${v}"` : v).join(' ');
    if (debug) {
        console.log('即将开始使用ffmpeg处理，命令行：');
        console.log(line);
    }
    let start = Date.now();
    let output = '';
    let offset = 0;
    let progressPosition = 0;
    await new Promise((resolve, reject) => {
        let p = child_process.execFile(cmd, args, {});
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

    let haoshi = Date.now() - start;
    console.log('处理完毕，输出文件：', output_file);
    console.log('耗时：', haoshi / 1000, '秒');
}

function getTransition() {
    let len = transitions.length;
    let i = Math.floor(Math.random() * len);
    return transitions[i];
}

function getMediaFiles(process_path) {
    let imgs = [];
    let audio_file = null;
    let subtitle_file = null;
    let list = fs.readdirSync(process_path, { withFileTypes: true });
    list = list.filter(v => v.isFile());
    list.sort((a, b) => {
        return a.name > b.name ? 1 : -1;
    });
    console.log('文件列表：', list.length == 0 ? '无' : '');
    list.length > 0 && console.log(list.map(v => v.name).join('\n'));
    for (const f of list) {
        let fullpath = path.join(process_path, f.name);
        if (isImage(fullpath)) {
            imgs.push(fullpath);
        } else if (isAudio(fullpath)) {
            if (!audio_file) {
                audio_file = fullpath;
            }
        } else if (isSubtitle(fullpath)) {
            if (!subtitle_file) {
                subtitle_file = fullpath;
            }
        }
    }
    console.log('图片列表：', imgs.length == 0 ? '无' : '');
    imgs.length > 0 && console.log(imgs.join('\n'));
    console.log('音频文件:', audio_file || '无');
    console.log('字幕文件:', subtitle_file || '无');
    return {
        imgs, audio_file, subtitle_file
    }
}

const IMAGE = 'image';
const AUDIO = 'audio';
const SUBTITLE = 'subtitle';
/**
 * @type {{image:[string],audio:[string],subtitle:[string]}}
 */
const FileExt = {
    'image': 'jpg jpeg png bmp webp'.split(' '),
    'audio': 'mp3 aac wav flac wma ape'.split(' '),
    'subtitle': 'lrc srt ass'.split(' '),
}
function isFileType(type, name) {
    return FileExt[type].includes(path.extname(name).toLowerCase().substr(1));
}
function isImage(name) {
    return isFileType(IMAGE, name);
}
function isAudio(name) {
    return isFileType(AUDIO, name);
}
function isSubtitle(name) {
    return isFileType(SUBTITLE, name);
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
    debug = !!args.debug;
    console.log('启动【图片转视频】');
    console.log('处理目录:', input);
    let overwrite = !!args.y;
    let output_file = args.o || path.join(input, 'output.mp4');
    if (fs.existsSync(output_file) && !overwrite) {
        console.log('输出文件已存在', output_file);
        return;
    }
    console.log('输出视频:', output_file)
    let { imgs, audio_file, subtitle_file } = getMediaFiles(input);
    if (imgs.length == 0) {
        console.log(`目录下无图片文件【${FileExt.image}】。`);
        return false;
    }
    let display = args.display || Display.Contain;
    if (Object.values(Display).includes(display) === false) {
        console.log('display参数值【', display, '】错误，将使用默认值“contain”');
        display = Display.Contain;
    }
    return await run({
        output_file, imgs, audio_file, subtitle_file,
        width: parseNumber(args.width, 1920),
        height: parseNumber(args.height, null),
        fps: parseNumber(args.fps, 25),
        crf: parseNumber(args.crf, 23),
        video_codec: args['c:v'] || 'h264',
        audio_codec: args['c:a'] || 'aac',
        display: display,
        repeat: !!args.repeat,
        tranDuration: parseNumber(args.td, 4),
        showDuration: parseNumber(args.sd, 7),
    });
}

module.exports = { start }

process.on('uncaughtException', (err) => {
    console.error(err);
});
process.on('unhandledRejection', (err) => {
    console.error(err);
});

if (process.argv[1] == __filename) {
    start();
}