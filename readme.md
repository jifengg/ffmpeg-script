# ffmpeg-script

一个使用ffmpeg实现各种功能的脚本集（nodejs）

## 运行环境

| 名称   | 版本     | 注意                     |
| ------ | -------- | ------------------------ |
| nodejs | 18.16.1+ |                          |
| ffmpeg | 4.4.2+   | 需要添加到环境变量path中 |

## 分析视频场景帧，并生成播放器支持的书签文件（PotPlayer）

### 运行

```bash
node ffmpeg.video2bookmark.js -i "视频文件（夹）完整路径"
```

将在视频文件同目录下创建同名的.pbf文件，该文件为PotPlayer支持的书签文件。打开视频文件将自动加载。更多书签的使用方式，请自行研究PotPlayer。

- 脚本为了方便使用，不使用第三方库，因此无需执行`npm install`；
- 分析需要对视频进行解码，受CPU性能影响；
- 更多参数可执行`node ffmpeg.video2bookmark.js`查看帮助文档