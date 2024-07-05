# ffmpeg-script

一个使用ffmpeg实现各种功能的脚本集（nodejs）

- [运行环境](#运行环境)
- [分析视频场景帧，并生成播放器支持的书签文件（PotPlayer）](#分析视频场景帧并生成播放器支持的书签文件potplayer)
  - [命令行示例](#命令行示例)
- [使用视频画面拼接自定义的字幕](#使用视频画面拼接自定义的字幕)
  - [命令行示例](#命令行示例-1)
- [以水平滚动的方式，展示多张图片](#以水平滚动的方式展示多张图片)
  - [命令行示例](#命令行示例-2)
- [为图片或视频添加自定义的水印，具有动态水印等多种高级功能。](#为图片或视频添加自定义的水印具有动态水印等多种高级功能)
  - [命令行示例](#命令行示例-3)
- [将多张图片转换成类似幻灯片的视频，支持多种转场效果](#将多张图片转换成类似幻灯片的视频支持多种转场效果)
  - [命令行示例](#命令行示例-4)

## 运行环境

| 名称   | 版本     | 注意                     |
| ------ | -------- | ------------------------ |
| nodejs | 18.16.1+ |                          |
| ffmpeg | 4.4.2+   | 需要添加到环境变量path中 |

> 脚本为了方便使用，尽量不使用第三方库，因此，如果没有特殊说明，每个文件均可以独立运行。  
> 无需执行`npm install`；

## 分析视频场景帧，并生成播放器支持的书签文件（PotPlayer）

### 命令行示例

```bash
node ffmpeg.video2bookmark.js -i "视频文件（夹）完整路径"
```

将在视频文件同目录下创建同名的.pbf文件，该文件为PotPlayer支持的书签文件。打开视频文件将自动加载。更多书签的使用方式，请自行研究PotPlayer。

- 分析需要对视频进行解码，受CPU性能影响；
- 更多参数可执行`node ffmpeg.video2bookmark.js -h`查看帮助文档
- 关于这个脚本的记录文章可以查看这里[docs/ffmpeg.video2bookmark.md](docs/ffmpeg.video2bookmark.md)


## 使用视频画面拼接自定义的字幕

### 命令行示例

```bash
node ffmpeg.subtitle.stack.js -i "视频文件路径" -t "文本文件路径" -font "字体文件路径"
```

- 更多参数可执行`node ffmpeg.subtitle.stack.js -h`查看帮助文档
- 关于这个脚本的记录文章可以查看这里[docs/ffmpeg.subtitle.stack.md](docs/ffmpeg.subtitle.stack.md)


## 以水平滚动的方式，展示多张图片

<details>
<summary>示例视频</summary>
<video src="https://github.com/jifengg/ffmpeg-script/assets/17020523/9441cc35-591c-486d-a8f5-d7768ffd5475" controls>你的浏览器不支持播放视频</video>
</details>

### 命令行示例

```bash
node ffmpeg.images.rolling.js -i "图片文件夹路径"
```

- 更多参数可执行`node ffmpeg.images.rolling.js -h`查看帮助文档
- 关于这个脚本的记录文章可以查看这里[docs/ffmpeg.images.rolling.md](docs/ffmpeg.images.rolling.md)


## 为图片或视频添加自定义的水印，具有动态水印等多种高级功能。


<details>
<summary>模拟DVD待机画面</summary>
<video src="https://github.com/jifengg/ffmpeg-script/assets/17020523/02c00806-2514-4dc8-9bdf-df53f66f9931" controls>你的浏览器不支持播放视频</video>
</details>

----

<details>
<summary>每1秒随机变换水印位置</summary>
<video src="https://github.com/jifengg/ffmpeg-script/assets/17020523/b5ba5de5-ca52-417e-a0b3-dbf43bf6bff4" controls>你的浏览器不支持播放视频</video>
</details>

----

身份证添加水印：

![idcard_watermark](https://github.com/jifengg/ffmpeg-script/assets/17020523/7e8dff92-feec-40e3-978f-54df1fabdad5)


### 命令行示例

```bash
node ffmpeg.watermark.js -i "图片文件夹路径"
```

- 更多参数可执行`node ffmpeg.watermark.js -h`查看帮助文档
- 更详细的帮助文档可以查看这里[docs/ffmpeg.watermark.help.md](docs/ffmpeg.watermark.help.md)
- 如果你对ffmpeg的开发感兴趣，关于这个脚本的技术文章可以查看这里[docs/ffmpeg.watermark.md](docs/ffmpeg.watermark.md)


## 将多张图片转换成类似幻灯片的视频，支持多种转场效果

<details>
<summary>效果预览</summary>
<video src="https://github.com/jifengg/ffmpeg-script/assets/17020523/fb0c9182-9161-4692-8884-a5faa98a3abd" controls>你的浏览器不支持播放视频</video>
</details>

### 命令行示例

```bash
node ffmpeg.img2video.js -i "图片文件夹路径"
```

- 将一个目录里的图片文件按顺序生成幻灯片视频，如果目录下有音频和字幕，也将第一个音频和字幕添加到视频里
- 更多参数可执行`node ffmpeg.img2video.js -h`查看帮助文档
- 如果你对ffmpeg的开发感兴趣，关于这个脚本的技术文章可以查看这里[docs/ffmpeg.img2video.md](docs/ffmpeg.img2video.md)
- 增加了对自定义转场效果的支持，并在[preset/xfade](preset/xfade)里预置了一些效果，点击[这里](docs/ffmpeg.img2video.custom.transitions.md)预览效果。
- 关于自定义转场效果要怎么写，可以查看这个文档[docs/ffmpeg.xfade.md](docs/ffmpeg.xfade.md)