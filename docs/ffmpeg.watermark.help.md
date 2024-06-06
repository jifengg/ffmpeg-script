# ffmpeg.watermark.js的使用帮助

## 脚本输出的帮助信息

运行`node ffmpeg.watermark.js -h`后可以得到

```shell
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
                <number>    水印的左、右、上、下边距，单位：像素。默认：right=20，top=20
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
```

## 多个水印信息的配置

本次脚本支持的水印有文本（`-text`）和文件（`-file`），且支持同时设置多个水印信息。因此，需要了解如何在命令行参数里通过相同的参数设置不同的水印配置。

和ffmpeg类似，当你使用-text的时候，可以用-fontsize、-fontcolor等参数来定义文本的格式。  
脚本规定：`定义水印信息的参数，均必须在-text或-file之前`，如果你把-fontsize放在-text之后，那它其实定义的是下一个水印（如果有的话）的字号。

例如，
```shell
node ffmpeg.watermark.js -i input.mp4 ^
-fontsize 40 -fontcolor blue -left 0 -top 0 -text "左上角蓝色的40号文字" ^
-left 0.5 -top 0.5 -text "画面中间的文本" ^
-move dvd -xspeed 400 -yspeed 300 -file "模拟dvd待机运动的图片.png" ^
-repeat -boxw 400 -boxh 40 -fontsize 30 -text "填充水印内容" ^
-right 0 -bottom 0 -scale 120:-1 -file "宽度缩放到120显示到右下角的图片.png"
```

> 为了方便观看，使用windows下的命令行分隔符^进行了多行分隔

这个示例里，分别定义了5个水印。其中第一个文本水印`-text "左上角蓝色的40号文字"`，它的自定义参数是`-fontsize 40 -fontcolor blue -text -left 0 -top 0`，这个参数列只会对这个-text生效。

第二个水印文本`-text "画面中间的文本"`，未定义`-fontsize`，前面的`-fontsize 40`也不会对它生效，因此它的字号是默认的`20`，同理这个文本的颜色也是默认的`white`而不是`blue`，其它参数同理。

第三个水印这是一个png图片，定义了“dvd”的运动方式，水平速度400px/s，垂直速度300px/s：`-move dvd -xspeed 400 -yspeed 300`，命令行里其它参数对它无效。

第四个、第五个同理，也都只有它前面的参数定义，如果未设置则使用默认值，而不是使用别的水印的设置。

## preset的编写

本次脚本，由于增加了很多配置参数，如果每次使用的时候都需要编写一长串参数，那么显然是十分麻烦的。因此，本次脚本支持使用-preset来定义一组参数。

首先需要编写preset文件，它是一个`utf8`编码的`文本文件`。文件名及存储路径可以随意。
比如创建一个文本文件`C:\mypreset\custom.txt`，并填写内容：

```shell
# 这是一个自定义的preset文件。这一行是注释
-fontsize
40
-fontcolor
blue
-left
0
-top
0
```

### 编写规则：

- 在命令行里用空格分隔的每个参数，在这里用换行符分隔。
- 前后不需要用引号，即使参数有空格也不需要引号，且含空格的行也算一个参数。
- 如果有对齐参数的需求，可以在前面使用空格。前后的空格均会被忽略。
- 以#或//开头的为注释。目前只支持行注释。如果要传的参数是#或//开头，则只需要在前面加空格即可。
- 脚本的所有参数，除了-preset，均可以在preset文件里定义。

> 在项目目录 `/preset` 有一些示例文件可以参考。

现在，上面示例的第一个水印则可以改成

```shell
node ffmpeg.watermark.js -i input.mp4 -preset "C:\mypreset\custom.txt" -text "左上角蓝色的40号文字" ^
```

### 使用方式

- 在`-preset xxx`的地方，可以看作是在命令行这里插入`xxx`中定义的参数，同样会受到参数顺序的影响；
- 可以多次使用`-preset`。如果有可能被覆盖的参数，则后定义的会覆盖先定义的；
- 如果文件是存放在脚本所在目录的`/preset/abc.preset`，则直接写`-preset abc`即可。
