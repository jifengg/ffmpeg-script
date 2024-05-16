# 以水平滚动的方式，展示多张图片

- [效果](#效果)
- [前言](#前言)
- [技术分析](#技术分析)
  - [图片移动](#图片移动)
  - [多张图片依次进行移动](#多张图片依次进行移动)
  - [图片周围增加间隔](#图片周围增加间隔)
  - [背景图片或背景颜色](#背景图片或背景颜色)
  - [标题和脚注](#标题和脚注)
  - [帧率](#帧率)
- [还可以实现的](#还可以实现的)
- [运行效率](#运行效率)


## 效果

<video src="https://github.com/jifengg/ffmpeg-script/assets/17020523/9441cc35-591c-486d-a8f5-d7768ffd5475" controls autoplay muted>你的浏览器不支持播放视频</video>

## 前言

前段时间看到一个视频，对某个游戏的物体进行了评分排行，然后用滚动的方式展示出来，想着这种方式应该可以用自动化的方式实现，于是就想着用 ffmpeg 实现一下。

## 技术分析

### 图片移动

使用[overlay](https://ffmpeg.org/ffmpeg-filters.html#overlay-1)过滤器。

这个过滤器，是“把一个视频叠加在另一个视频上”。  
其中，你可以通过`x`和`y`参数来控制叠加的位置。x和y都支持表达式。  
注意这个过滤器是支持“[时间轴](https://ffmpeg.org/ffmpeg-filters.html#Timeline-editing)”的。  
于是可以使用表达式来达到不同时间计算出不同的x、y值来达到`移动`的效果。
具体使用方式可以参考官方文档。

### 多张图片依次进行移动

这里我实现的效果比较简单，一开始所有图片都是排好队进行移动的。  
因此，使用了`水平拼接`过滤器[hstack](https://ffmpeg.org/ffmpeg-filters.html#hstack-1)，将图片依次拼接，然后对拼接后的图片进行移动，即可达到效果。

### 图片周围增加间隔

`hstack`没有类似`padding`的参数可以来指定每个视频间的间距。  
虽然可以使用 `pad`+`overlay`的方式在排列所有图片，但是需要计算。  
因此，我选择对输入图片进行处理。在输入图片四周增加透明像素，来达到间隔的效果。  
主要用到`scale`和`pad`过滤器。  
用scale是因为所有图片要统一等比例缩放到相同的高度。（宽度可以不一样）。

假设要在图片上增加间隔分别是left、right、top、bottom，统一高度是height。  
先`scale`图片高度为 `height-top-bottom`，宽度等比（-2表示保持源比例，并使计算出来的值能被2整除）
```
scale=-2:height-top-bottom
```
再使用`pad`过滤器，将宽度设置为scale之后的图片的宽度+left+right，高度+top+bottom，并把图片在pad上的坐标设置为x=left,y=top，同时，pad的color设置为完全透明。
```
pad=w=iw+left+right:h=ih+top+bottom:x=left:y=top:color=black@0
```

> 目前脚本会对所有图片进行增加padding操作，包括第一张和最后一张，因此，如果设置了leftPadding，则第二帧有可能还看到不到图片。

### 背景图片或背景颜色

输出视频需要指定分辨率（默认1920x1080），如果使用背景颜色，则通过[lavfi](https://ffmpeg.org/ffmpeg-devices.html#lavfi)来设置
```
-f lavfi -t 1 -r 1/1000 -i color=c=black:s=1920x1080
```

如果使用背景图片，则将背景图片scale到指定分辨率即可。脚本里在scale之前，增加了一个模糊滤镜，可以将背景图进行`高斯模糊`[gblur](https://ffmpeg.org/ffmpeg-filters.html#gblur)。
当然如果不需要模糊，则使用命令行参数 `-blursigma 0`覆盖默认值即可。

### 标题和脚注

这是一个附加功能，使用[drawtext](https://ffmpeg.org/ffmpeg-filters.html#drawtext-1)实现。

### 帧率

图片每一帧的x坐标都在变化，如果视频帧率和显示器帧率无法很好匹配，参考影视飓风的视频[《影视飓风将停止制作25帧视频》](https://www.bilibili.com/video/BV1hp4y1f7B5)，将会看到很明显的卡顿的情况，请根据你实际的情况选择合适的帧率（-fps，默认值是25）。

## 还可以实现的

因为输出是视频，所以，视频相关可以设置的参数实在是太多了。本脚本为了简单，调用ffmpeg的时候，只使用了`-crf 23`，其它参数则是ffmpeg默认。  
这表示，你可以用`-o out.mkv`来直接输出mkv封装的视频，也可以用`-o out.webp`来直接输出webp动态图片（但是很慢，我试过，慢20倍）。  
如果需要其他自定义的ffmpeg输出视频参数，请自行修改脚本。

## 运行效率

[效果](#效果)中的视频，使用10张270x400的图片，视频分辨率1280x480，fps=29.97，总时长30秒。在我的电脑上运行是1.98秒，CPU占用率极低。仅供参考。
