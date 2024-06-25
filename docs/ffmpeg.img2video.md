# 将多张图片转换成类似幻灯片的视频，支持多种转场效果

- [效果](#效果)
- [前言](#前言)
- [技术分析](#技术分析)
  - [以图片做为输入并当成视频流处理](#以图片做为输入并当成视频流处理)
  - [视频与视频合并时，增加转场效果](#视频与视频合并时增加转场效果)
- [还能做得更好的](#还能做得更好的)
- [运行效率](#运行效率)

## 效果

<video src="https://github.com/jifengg/ffmpeg-script/assets/17020523/fb0c9182-9161-4692-8884-a5faa98a3abd" controls autoplay muted>你的浏览器不支持播放视频</video>

## 前言

从图片快速生成幻灯片视频，使用多种转场效果，并配上音乐和歌词。这可以快速的为自己制作一个酷炫的个人图片展示视频。  
它有很多适用的场景，不过，也可能会被用于制造一些低质量的视频，请不要滥用本脚本。

这个脚本，最终生成的是一条ffmpeg的命令行，可以直接复制到控制台运行，效果和脚本是一模一样的。  
脚本本身只是组织并生成了这条命令，并没有处理任何媒体文件。这让我知道了ffmpeg的强大。

这个脚本其实可以算是我编写的最早的一个ffmpeg脚本，只是一直没有再好好整理，这次正好趁着往脚本集添加的机会，重新梳理了一些逻辑、修复了一些bug、增加了一些配置项。

## 技术分析

### 以图片做为输入并当成视频流处理

在ffmpeg的[官方wiki页面](https://trac.ffmpeg.org/wiki/Slideshow#Singleimage)有介绍：

```shell
# 将一张图片转换成30秒的视频文件，它的帧率是默认的25fps
ffmpeg -loop 1 -i img.jpg -c:v libx264 -t 30 -pix_fmt yuv420p out.mp4
```

其中，`-loop 1 -i img.jpg`，ffmpeg会根据`img.jpg`推断输入文件格式是`image2`（查看[image2官方文档](https://ffmpeg.org/ffmpeg-formats.html#image2-1)）。  
`-loop 1`则是表示需要循环播放，因为我们的输入其实只有一帧，如果不加这个，即使`-t 30`，最后出来的也是只有一帧的mp4。

这里，有一个很重要的优化点，就是，`image2`的一个参数`framerate`，默认是25。  
ffmpeg内部的逻辑我不清楚（源码看不懂），但是，我们通过以下的一个测试可以发现，如果把帧率设置为一个很小的值（1/1000，也就是1000秒只有1帧），再通过`fps`过滤器改变为25，ffmpeg的效率会提高很多。

> 1.jpg的分辨率是1440x900  
> Take time 表示耗时  
> CPU max 表示CPU占用率  
> Memory max 表示内存占用率  
> 经过比较，out.mp4和out2.mp4文件hash值完全一样

```shell
ffmpeg -y -loop 1 -r 1/1000 -i 1.jpg -filter_complex fps=25 -c:v libx264 -t 30 -pix_fmt yuv420p out.mp4
# Take time: 2.019 s
# CPU max: 106.300   min: 0.000   avg: 17.717
# Memory max: 696,909,824   min: 652,161,024   avg: 680,211,797

ffmpeg -y -loop 1 -i 1.jpg  -c:v libx264 -t 30 -pix_fmt yuv420p out2.mp4
# Take time: 4.973 s
# CPU max: 50.000   min: 0.000   avg: 9.653
# Memory max: 666,927,104   min: 580,550,656   avg: 636,126,870
```

可以看到，使用`fps`过滤器的执行耗时，比默认的快很多。图片分辨率越大，这个效率提升会更明显。

以下1.jpg分辨率为`6000x4000`，使用`scale`转换到高度为1080，输出的两个文件hash值完全一样，可以更明显地看到效率的差别。

```shell

ffmpeg -y -loop 1 -r 1/1000 -i 1.jpg -filter_complex scale=-2:1080,fps=25 -c:v libx264 -t 30 -pix_fmt yuv420p out.mp4
# Take time: 2.942 s
# CPU max: 342.200   min: 0.000   avg: 45.160
# Memory max: 1,413,341,184   min: 1,177,849,856   avg: 1,268,655,308

ffmpeg -y -loop 1 -i 1.jpg -filter_complex scale=-2:1080 -c:v libx264 -t 30 -pix_fmt yuv420p out2.mp4
# Take time: 122.466 s
# CPU max: 95.400   min: 0.000   avg: 4.231
# Memory max: 1,138,155,520   min: 262,033,408   avg: 1,066,734,656
```

综上，不管你输入图片分辨率是多少，都建议你使用1/1000fps做为输入帧率，对输入进行必要的处理之后，再转换成25fps。  
当然，你要理解，我们能这么做，是因为图片转视频，每一帧都是一样的。  
我们做的优化其实是：
- 减少ffmpeg通过image2格式生成输入视频流的耗时
- 减少需要处理的视频帧数量。

> 有一种情况不适用，就是输入是`图片序列`（[Wiki](https://trac.ffmpeg.org/wiki/Slideshow#Sequential)），每个图片表示一帧，这种情况就不能使用这个方法了。

### 视频与视频合并时，增加转场效果

直接看ffmpeg文档[xfade](https://ffmpeg.org/ffmpeg-filters.html#xfade)。  
它的输入是2个视频源。

需要理解几个参数：
- duration：转场动画的时长，单位秒
- offset：从第1个视频的第几秒开始转场。
- transition：转场动画的过渡效果。例如fade表示淡入淡出
  
举例，两个9.0秒的视频，`transition=fade:duration=2:offset=5`表示：
- 0.0~5.0秒：第一个视频的画面
- 5.0~7.0秒：第一个视频画面渐渐消失，同时第二个视频画面渐渐出现
- 7.0~14.0秒：第二个视频画面

总共生成14.0秒时长的视频，其中，第一个视频在转场结束的时候还没播完，画面将不再出现。转场结束之后，会持续到第二个视频结束。  

> 如果第二个视频的时长不足2秒会怎样？请自行实践。

这个过滤器还有一个参数`expr`，它允许我们自定义过渡效果。不过这个在网上资料很少，正在研究，有点成果但不多。等我研究透了再更新。

## 还能做得更好的

xfade提供有56种内置效果，能满足大部分需求。不过，更复杂的过渡效果（例如翻页）还没有。  
使用custom+expr能做到什么效果，还有待研究。

脚本目前的配置还比较粗糙，转场效果用的是随机的，时长控制是统一的。后续考虑增加一些`项目文件`之类的文件，可以自主的控制每个图片的转场效果、持续时长、显示类型等等。

## 运行效率

[效果](#效果)中的视频，使用5张1440x900的图片，视频分辨率600 x 336，fps=12，总时长10秒。在我的电脑上运行是0.536秒，仅供参考。