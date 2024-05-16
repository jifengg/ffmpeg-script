# ffmpeg-script

一个使用ffmpeg实现各种功能的脚本集（nodejs）

- [运行环境](#运行环境)
- [分析视频场景帧，并生成播放器支持的书签文件（PotPlayer）](#分析视频场景帧并生成播放器支持的书签文件potplayer)
  - [命令行示例](#命令行示例)
- [使用视频画面拼接自定义的字幕](#使用视频画面拼接自定义的字幕)
  - [命令行示例](#命令行示例-1)
- [以水平滚动的方式，展示多张图片](#以水平滚动的方式展示多张图片)
  - [命令行示例](#命令行示例-2)

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