# ffmpeg.img2video.js 中自定义动画效果预览及使用

以下自定义动画效果脚本均在[preset/xfade](../preset/xfade)下。

## 效果预览

windowblind

<video src="https://github.com/jifengg/ffmpeg-script/assets/17020523/b06bc6f2-5a4f-489b-b21e-f2effc254ff2" controls muted>你的浏览器不支持播放视频</video>

----

windowslice

<video src="https://github.com/jifengg/ffmpeg-script/assets/17020523/0bc0a7b7-c340-45d5-9536-ba810fe0dc8a" controls muted>你的浏览器不支持播放视频</video>

----

WaterDrop

<video src="https://github.com/jifengg/ffmpeg-script/assets/17020523/a8ef2c9d-db8a-4079-be7d-c062ec0c68ef" controls muted>你的浏览器不支持播放视频</video>

----

BowTieVertical

<video src="https://github.com/jifengg/ffmpeg-script/assets/17020523/8f9cbe11-b7ce-41ea-8546-db0bcaa0fa5f" controls muted>你的浏览器不支持播放视频</video>

----

BowTieHorizontal

<video src="https://github.com/jifengg/ffmpeg-script/assets/17020523/1b89dd72-413a-4f30-9d33-5a6b9d35ad17" controls muted>你的浏览器不支持播放视频</video>

----

FlipOver

<video src="https://github.com/jifengg/ffmpeg-script/assets/17020523/176581db-0d01-4de1-9268-c9490b34ce86" controls muted>你的浏览器不支持播放视频</video>

----

mosaic

<video src="https://github.com/jifengg/ffmpeg-script/assets/17020523/b6b8279f-2d79-4e11-a688-80c0efe303fa" controls muted>你的浏览器不支持播放视频</video>

----

directionalwarp

<video src="https://github.com/jifengg/ffmpeg-script/assets/17020523/791ab69a-fe68-448e-88e8-1152215e3f03" controls muted>你的浏览器不支持播放视频</video>

----

progressive

<video src="https://github.com/jifengg/ffmpeg-script/assets/17020523/4f2dfcbf-46e7-470c-9670-98655b7e26ec" controls muted>你的浏览器不支持播放视频</video>

----

alternateProgressive

<video src="https://github.com/jifengg/ffmpeg-script/assets/17020523/b0c57a82-0d9e-43b3-97c8-79694aa0b322" controls muted>你的浏览器不支持播放视频</video>

----

Dreamy

<video src="https://github.com/jifengg/ffmpeg-script/assets/17020523/77abb511-f11d-4a41-b204-534ff993e7c8" controls muted>你的浏览器不支持播放视频</video>

----

pinwheel

<video src="https://github.com/jifengg/ffmpeg-script/assets/17020523/54539a49-c22b-4384-8f1a-9eca64434e28" controls muted>你的浏览器不支持播放视频</video>

----


## 使用方式

示例：

```shell
node ffmpeg.img2video.js -i <input> -disable_buildin_transitions -transitions "pinwheel,Dreamy"
```

```
-transitions    <string>    要使用的转场动画集，使用逗号分隔，如 fade,wipeleft,wiperight,wipeup,mytran1
                            其中，支持自定义的转场动画，如 mytran1 表示 ./preset/xfade/mytran1.txt
                            自定义转场动画的编写请参考github（https://github.com/jifengg/ffmpeg-script）。
-disable_buildin_transitions
                <boolean>   禁用脚本中内置的ffmpeg的转场动画，只使用-transitions定义的，默认：false
```