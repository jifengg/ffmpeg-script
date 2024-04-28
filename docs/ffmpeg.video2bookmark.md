# 分析视频场景帧，并生成播放器支持的书签文件（PotPlayer）

很多播放器都有一个生成缩略图墙的功能，能够给一个视频生成n*m张缩略图并拼成一张大图，一般在发布该视频的文章中可以看到。  
如PotPlayer，快捷键是Alt+N（唤起完整菜单快捷键是K）。  
不方便的地方是没法快速跳转到对应的时间点。  
要能跳转时间点，那么用书签功能是很合适的，于是就是看怎么生成播放器能解析的书签文件。

## 试图分析PotPlayer的书签文件格式

PotPlayer支持后缀名为`.pbf`的书签格式，可以使用快捷键H唤起书签菜单查看更多功能。  
勾选“将书签保存在视频文件夹”后，按P创建一个书签，关闭播放器后就会在视频同目录下看到创建的pbf文件。

可以使用文本编辑器打开该文件，可以发现其基本格式

```ini
[Bookmark]
0=83458*书签 1*2800000048000000480000000100200004000000000000000000000000000000000000000000000000083458FFD8FFE000104A46494600010.....
1=87750*书签 2*2800000048000000480000000100200004000000000000000000000000000000000000000000000000087750FFD8FFE000104A46494600010.....
2
```

官网没有对该文件格式的说明，google也未搜索到，于是对其简单测试后猜测

```
<序号>=<毫秒>*<书签名>*<40个固定的字符><48个变化的字符><图片文件的字节16进制表示>
```

其中`40个固定的字符`=`2800000048000000480000000100200004000000`。  
而`48个变化的字符`未发现其规律，但是值又不影响功能，所以在我的脚本中用了毫秒数前补位0。  
`图片文件的字节16进制表示`，主要是因为，`FFD8FF`正好是`jpg`文件的文件头，于是省了好多猜测时间，连base64都省了。

经过测试这个16进制保存成二进制文件后确实是一个jpg文件。

这是JavaScript的脚本：
<details>

```javascript
const fs = require('fs');
/**
 * 将16进制或二进制表示的字节码转成Uint8Array，如"FF02"转成[0xff, 0x02]
 * @param {String} str 
 * @param {16|2} radix 
 * @returns {Uint8Array}
 */
function str2bin(str, radix = 16) {
    if (radix != 16 && radix != 2) throw new Error('radix must be 16 or 2');
    let padNum = radix == 16 ? 2 : 8;
    if (str.length / padNum % 1 != 0) throw new Error('str length must be multiple of ' + padNum);
    bufferDecode = [];
    for (let i = 0; i < str.length; i += padNum) {
        let byte2 = str.substring(i, i + padNum);
        let b = parseInt(byte2, radix);
        bufferDecode.push(b);
    }
    return Uint8Array.from(bufferDecode);
}

/**
 * 
 * @param {String} str 
 * @param {String} filepath 
 * @returns {Promise}
 */
function hexstr2file(str, filepath) {
    let bufs = str2bin(str);
    return new Promise((resolve, reject) => {
        fs.createWriteStream(filepath).write(bufs, (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    })
}

hexstr2file("FFD8FF....","path/to/file.jpg");
```
</details>

## ffmpeg生成缩略图的研究

### 阅读ffmpeg的wiki

[ffmpeg的wiki](https://trac.ffmpeg.org/wiki)中有一篇文章[Create a thumbnail image every X seconds of the video](https://trac.ffmpeg.org/wiki/Create%20a%20thumbnail%20image%20every%20X%20seconds%20of%20the%20video)，详细介绍了几种从视频中生成帧图片的方法

> 注意：文档中`thumbnail`的命令行应该用`ffmpeg -i input.flv -vf thumbnail=n=100 -vsync vfr thumb%04d.png`才能间隔100帧生成一张图片，否则会按照源帧率生成

### 用哪种方式？

- `-frames`：适合抽取一张，不适合跳着抽取；
- `fps`：按照固定的间距抽取，如果对结果要求不高可以使用这个方式；
- `thumbnail`：类似`fps`，但是，它会在n帧内按照算法自行选择一帧，不是每n帧取第一帧，基本也可以算是固定间隔；
- `select`：有丰富的选项，而且从wiki中的命令`eq(pict_type,PICT_TYPE_I)`就可以看到，它可以按照帧类型选择（I帧），这感觉更符合需求；

> `select`过滤器[官方文档](https://ffmpeg.org/ffmpeg-filters.html#select_002c-aselect)

通过阅读文档，还发现`select`有一个计算值`scene`，取值0.0 ~ 1.0之间，用来表示“当前帧是一个新场景”的概率，通过底下的`Examples`官方建议值是0.3 ~ 0.5之前比较合理。

经过测试，取0.5时，效果已经非常好，当然可能不同的视频内容会需要不同的值，因此后续在脚本中也会将这个值作为可选参数列出。

## 如何记录图片对应的时间点？

如果你跑了上面的命令，会发现图片序列已经生成好了，但是，我们并不知道每张图片对应的时间点。  
因此，还需要一个手段可以把时间点记录下来。

好在，ffmpeg已经提供了能打印丰富帧信息的过滤器[showinfo](https://ffmpeg.org/ffmpeg-filters.html#showinfo)
会打印输入流的每一帧的信息，包含帧序号、pts、pts时间等。  
以下是某个输出：
```
[Parsed_showinfo_0 @ 00000149d13733c0] n:3043 pts:1558016 pts_time:101.433333 duration:    512 duration_time:0.0333333 fmt:yuv420p cl:left sar:1/1 s:1920x804 i:P iskey:0 type:P checksum:FB3D9DD5 plane_checksum:[4091A083 CD555D97 509C9FAC] mean:[91 129 124] stdev:[46.2 1.9 3.1]
[Parsed_showinfo_0 @ 00000149d13733c0] color_range:tv color_space:bt709 color_primaries:bt709 color_trc:bt709
```

其中，`pts_time`单位是毫秒，在没有其他修改pts过滤器的情况下，你可以认为就是这一帧在原视频的时间点。  
这个输出信息是和其他信息一样在ffmpeg的error输出流里的，除了重定向，没法通过给ffmpeg传一个文件路径的方式保存这些信息，因此后续脚本需要对这个信息进行处理。

因此，我们只需要在`select`过滤器后面带上`showinfo`，就可以打印选中的帧信息了。

## 合并后的命令行

```
ffmpeg -y -hide_banner -i "input.mp4" -filter_complex select='gt(scene,0.5)*eq(pict_type,I)',scale=-2:72,showinfo=checksum=0 -vsync vfr scene/preview%5d.jpg
```

命令解析：

- `-y`：覆盖输出文件
- `-hide_banner`：不打印ffmpeg的版本信息
- `-i`：输入文件
- `-filter_complex`：复合过滤器
- `select`：`帧选择`过滤器，`gt(scene,0.5)`表示选择`scene`值大于0.5的帧，`eq(pict_type,I)`表示选择I帧
- `scale`：`缩放`过滤器，`-2:72`表示高度缩放为72像素，宽度按比例缩放并且保持2的倍数
- `showinfo`：`打印帧信息`过滤器，`checksum=0`表示不打印帧校验码
- `-vsync vfr`：`视频同步`过滤器，`vfr`表示按照帧率计算时间
- `scene/preview%5d.jpg`：输出文件及占位符，`%5d`表示根据帧序号生成5位数的数字，如“00001”。鉴于是关键帧且scene大于0.5，5个数字可以认为已足够。


## 后续优化

使用以上命令输出后，会发现，有些时间区间生成的帧很密集，比如有些画面切换很快的场景。  
而有些时间段，可能十几分钟都没有一帧。这样在播放器中选择的时候信息量不够。  
我们可能想要：

- 如果当前帧距离上一个选择的帧太近（20秒），那么就不要这一帧；
- 如果当前帧距离上一个选择的帧太远（60秒），那么就选择这一帧；

好在，`select`提供的表达式及字段能够满足这个需求

- `prev_selected_t`：上一次选择的帧的时间点，如果每选过就是NAN；
  
此时，需要再复习一下`select`的语法，它后面默认跟着一个表达式expr，如果这个表达式计算结果等于0，则舍弃这一帧。  
非0时，会根据值来决定帧发送给哪个输出流，因为我们只用一个输出流，因此可以认为非0都是选中的帧。

<details>
<summary>官方文档摘录</summary>

This filter accepts the following options:

expr, e
Set expression, which is evaluated for each input frame.

If the expression is evaluated to zero, the frame is discarded.

If the evaluation result is negative or NaN, the frame is sent to the first output; otherwise it is sent to the output with index ceil(val)-1, assuming that the input index starts from 0.

For example a value of 1.2 corresponds to the output with index ceil(1.2)-1 = 2-1 = 1, that is the second output.

outputs, n
Set the number of outputs. The output to which to send the selected frame is based on the result of the evaluation. Default value is 1.

</details>

因此把select过滤器改为：
```
select='(isnan(prev_selected_t)+gte(t-prev_selected_t,20))*(gt(scene,0.5)*eq(pict_type,I)+gte(t-prev_selected_t,60))' 
```
其中，
- `isnan(prev_selected_t)+gte(t-prev_selected_t,20)`：
  - 如果还没选过帧，可以计算这一帧，此时，isnan(prev_selected_t)=1；
  - 如果距离上一帧超过20秒，可以计算这一帧，此时，gte(t-prev_selected_t,20)=1；
  - 也就是说，如果选过帧了且这一帧距离上一帧小于20秒，则不用计算了，因为两个值都是0；
- `gte(t-prev_selected_t,60)`：如果距离上一帧超过60秒，则选择这一帧；没超过60秒的，就看`gt(scene,0.5)*eq(pict_type,I)`的计算结果了。

## 脚本编写

有了以上的理论基础，就可以开始编写脚本了。  
脚本首先实现根据showinfo的输出，将对应的图片转换后，生成对应的pbf文件。  
接着增加遍历文件夹的功能，使可以进行批处理，并使用后缀名简单区分视频文件。  
又根据实际情况，开发了一些可以自行修改的参数，可以适配不同的需求。  

## 关于运行效率

由于`select`过滤器需要`解码`整个视频流，加上计算`scene`和`scale`的一些耗时，因此运行效率会受cpu性能影响，本脚本暂时没测试使用`硬件编码器`的加速效果。  
在`N5105`cpu的机器上，运行解析1080P视频，效率大概是8倍速，也就是8分钟的视频需要1分钟时间。  
其他CPU可以自行测试，使用`-debug`查看ffmpeg的运行信息。
