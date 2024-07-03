# ffmpeg过滤器xfade自定义动画的研究

- [前言](#前言)
- [效果预览](#效果预览)
  - [水滴](#水滴)
  - [百叶窗](#百叶窗)
  - [简易翻页](#简易翻页)
- [ffmpeg官方wiki](#ffmpeg官方wiki)
- [ffmpeg官方文档翻译](#ffmpeg官方文档翻译)
- [理解 P](#理解-p)
- [理解 X,Y,W,H](#理解-xywh)
- [理解 PLANE,A,B,a0(x,y),...,b0(x,y),...](#理解-planeaba0xyb0xy)
- [理解 expr](#理解-expr)
  - [尝试1，实现渐隐渐显效果](#尝试1实现渐隐渐显效果)
  - [尝试2，实现擦除效果](#尝试2实现擦除效果)
  - [尝试3，实现推走效果](#尝试3实现推走效果)
- [小结](#小结)
- [性能](#性能)
- [其它转场过滤器](#其它转场过滤器)
  - [xfade\_opencl](#xfade_opencl)
  - [gl-transition](#gl-transition)
- [结语](#结语)


## 前言

使用`xfade`过滤器做视频转场切换效果，本身ffmpeg已经提供了56种效果，能满足大部分需求。不过，更复杂的过渡效果（例如翻页）还没有。  
根据文档，使用transition=custom+expr，可以实现自定义的效果。但是，官方文档并没有对`expr`如何编写做详细说明，也没有google到。  
因此，对其进行了一番研究，尝试实现了几种效果。简单做一个使用教程，希望能够帮助到有需要的人。  

## 效果预览

### 水滴

<video src="https://github.com/jifengg/ffmpeg-script/assets/17020523/b3cec5b1-d747-46bd-aae1-924289aaddce" controls muted>你的浏览器不支持播放视频</video>

### 百叶窗

<video src="https://github.com/jifengg/ffmpeg-script/assets/17020523/1bef9ae3-41c3-4747-ae41-9056ae4e6892" controls muted>你的浏览器不支持播放视频</video>

### 简易翻页

<video src="https://github.com/jifengg/ffmpeg-script/assets/17020523/30c810a1-7522-4829-8450-4602c8203853" controls muted>你的浏览器不支持播放视频</video>

## ffmpeg官方wiki

[https://trac.ffmpeg.org/wiki/Xfade](https://trac.ffmpeg.org/wiki/Xfade)

## ffmpeg官方文档翻译

以下翻译自[FFmpeg xfade官方文档](https://ffmpeg.org/ffmpeg-filters.html#xfade)

<details>

<pre>xfade

将淡入淡出从一个输入视频流应用到另一个输入视频流。淡入淡出将持续指定的时间。
两个输入必须是恒定帧速率，并且具有相同的分辨率、像素格式、帧速率和时间基准。

该过滤器接受以下选项：

transition
    'custom'
    [忽略]

duration
    设置交叉淡入淡出持续时间（以秒为单位）。范围为 0 至 60 秒。默认持续时间为 1 秒。

offset
    设置相对于第一个输入流的交叉淡入淡出开始时间（以秒为单位）。默认偏移量为 0。

expr
    设置自定义过渡效果的表达式。
    表达式可以使用以下变量和函数：

    X
    Y
        当前样本的坐标。

    W
    H
        图像的宽度和高度。

    P
        过渡效果的进展。
        【译注】过渡开始时，P=1.0，过渡结束时，P=0.0。

    PLANE
        目前正在处理的平面。
        【译注】这里的平面，其实就是指像素格式的分量。
        【译注】取值范围由输入流的像素格式pix_fmt决定，如 yuv420p，则取值范围是0，1，2；如 rgba，则取值范围是0，1，2，3。

    A
        返回第一个输入流在当前位置和平面的值。

    B
        返回第二个输入流在当前位置和平面的值。

    a0(x,y)
    a1(x,y)
    a2(x,y)
    a3(x,y)
        返回第一个输入的第一/第二/第三/第四个分量的 位置 (x,y) 处的像素的值。
        【译注】例如，像素格式是yuv420p，a0返回的是 Y 分量。a1返回的是 U 分量。a2返回的是 V 分量。没有a3

    b0(x,y)
    b1(x,y)
    b2(x,y)
    b3(x,y)
        返回第二个输入的第一/第二/第三/第四个分量的 位置 (x,y) 处的像素的值。
</pre>
</details>

## 理解 P

一般来说，ffmpeg中支持时间轴编辑的过滤器，都有`t`和`n`参数可以用在表达式中，其中`t`表示时间秒，`n`表示帧数。  
但是xfade里却是用的P，它不是`t`或`n`。如果你理解错了，会发现自定义效果完全没效。  
因为，它表示的是过渡效果的进度，而且，重要的是，它是个递减的数。  
- 过渡动画开始的时候，P=1.0；
- 过渡动画结束的时候，P=0.0；
- 它的值是按帧线性递减的，例如，duration=4，fps=25，那么第二帧的时候，P=1.0-1/(4*25)=0.99；
- 可以通过数学函数来改变P的“线性”，例如 P\*P\*(3-2P)，（[Smoothstep](https://en.wikipedia.org/wiki/Smoothstep)，[函数图](https://zh.numberempire.com/graphingcalculator.php?functions=x*x*(3-2*x)&xmin=0&xmax=1&ymin=0&ymax=1&var=x)）。
  - 注意，P是从1.0到0.0，因此查看函数图的时候要注意从右往左看。
  - 如果你觉得从右往左看不直观，把所有P都改成(1-P)吧。
  - win11自带的计算器有一个“绘图”功能，能够很好的显示各种数学函数的图形，可以用来辅助理解。

## 理解 X,Y,W,H

X,Y表示坐标，是指“当前正在计算表达式的像素的坐标”，按照我们要实现的效果，决定该像素对应的颜色码。

W,H是图像的宽高，这个在整个渐变过程是保持不变的。

## 理解 PLANE,A,B,a0(x,y),...,b0(x,y),...

a0(x,y)表示第一个视频坐标x,y处的像素的第一个分量值。
PLANE表示当前是计算的第几个分量值。
A是一个简写，当PLANE=0时,A=a0(X,Y)；PLANE=1时，A=a1(X,Y)；PLANE=2时，A=a2(X,Y)；以此类推。
b和B同a和A。

> 注意，无法通过类似`a(plane,x,y)`的方法来获得指定坐标指定分量的值，因此在像素有位移的时候，表达式会比较长。如`if(eq(PLANE,0),a0(X,Y),if(eq(PLANE,1),a1(X,Y),if(eq(PLANE,2),a2(X,Y),0)))`

## 理解 expr

`xfade`的`expr`，返回一个值，但是这个值是什么含义呢，一般人看文档很难理解。  
以 `300x200` 的输入源为例，假设其像素格式是yuv420p，则其分量个数是3。（ffmpeg支持的像素格式及格式信息，可以通过`ffmpeg -pix_fmts`查看）。
像素点是`60000`个，每一帧的像素分量总数就是`60000*3=18万`个。  
那么，过渡开始的第一帧，ffmpeg会遍历每个像素点的每个分量，分别调用`expr`，并设置X,Y,PLANE等值。总共调用`18万`次获得对应的值，来完成第一帧的渲染。 
如果我们希望每一帧就是显示第一个视频的画面，那么可以写`expr=A`即可。`A`表示的就是第一个视频当前像素当前分量的值。  

### 尝试1，实现渐隐渐显效果

如果我们希望实现第一个视频渐渐变透明，第二个视频由透明渐渐显现，类似`xfade`默认的效果`fade`，那么可以写`expr='A*P+B*(1-P)'`。  
因为P是从1.0线性变成0.0的。所以一开始P=1，表达式计算结果=`A`，看到的就是只有第一个视频画面，到一半时，P=0.5，结果=`0.5A+0.5B`，画面就是两个视频分别半透明叠加在一起。最后P=0.0时，结果=`B`，就只剩下第二个视频的画面了。

### 尝试2，实现擦除效果

同样的，如果我们希望实现一个从右往左擦除的效果（图片引用自[https://trac.ffmpeg.org/wiki/Xfade](https://trac.ffmpeg.org/wiki/Xfade)）：  
![wipeleft](https://trac.ffmpeg.org/raw-attachment/wiki/Xfade/wipeleft.gif)

分析一下，分割线在画面水平线上的位置X，除以宽度W，其实就是等于P，于是，我们可以让分割线左边的显示画面A，右边的显示画面B。
`expr='if(lt(X/W,P),A,B)'`：当`X/W<P`的时候，说明X在分割线左边，于是显示A，否则显示B。

> 分割线上显示A还是B，影响不大。这里是显示了B，如果要显示A，可以用`lte`代替`lt`。

### 尝试3，实现推走效果

从上面两个例子你大概能理解expr要返回什么内容了。我们接着第三个例子。
如果我们希望实现的是一个从右往左`推走`的效果：  
![slideleft](https://trac.ffmpeg.org/raw-attachment/wiki/Xfade/slideleft.gif)

你会发现，变得更复杂了。你可以先暂停试试自己能否写出来。

为什么更复杂了？以坐标(0,0)为例，他显示的像素时刻都在变化（因为画面在往左移动）。  
例如，在P=0.8的时候，它(0,0)应该是视频A X=W*0.2,Y=0坐标处的像素值。（这里需要好好理解，参考下图帮忙理解）

![image](https://github.com/jifengg/ffmpeg-script/assets/17020523/c8e6a23c-03f2-4f56-9db4-1b7afe0d383b)

在`X/W>P`的地方，应该显示视频B的画面，其坐标转换关系是(X-P*W,Y)。  
注意，此时你没法再用值`A`和`B`了，因为它们是坐标(X,Y)的分量，而我们要在(X,Y)处显示别的坐标的像素，这个我们在上面[理解 PLANE,A,B,a0(x,y),...,b0(x,y),...](#理解-planeaba0xyb0xy)的地方说过了。

那么这个表达式要怎么写呢？

```
expr='if(lt(X/W,P),^
if(eq(PLANE,0),a0(X+(1-P)*W,Y),^
if(eq(PLANE,1),a1(X+(1-P)*W,Y),^
if(eq(PLANE,2),a2(X+(1-P)*W,Y),0)))^
,^
if(eq(PLANE,0),b0(X-P*W,Y),^
if(eq(PLANE,1),b1(X-P*W,Y),^
if(eq(PLANE,2),b2(X-P*W,Y),0)))^
)'
```

> 我测试的时候用的是windows的bat脚本，为了方便理解和修改，用^进行了换行。注意不要有空格，否则会报错。   
> 测试的时候用的是yuv420p像素格式，因此表达式没有用到a3，如果是用了4个分量的像素格式需要把a3按照上面的格式加进去。

其中，分割线左边显示视频A的画面，且x坐标左移了(1-P)*W个像素，因此其x坐标表达式是`X+(1-P)*W`；  
右边显示视频B的画面，且x坐标右移到了分割线右边，因此其x坐标表达式是`X-P*W`。  
因为是水平移动，所以y坐标保持`Y`即可。

于是，随着P从1.0渐变到0.0，视频A就像被视频B从右边推到了左边，完成了一个过渡效果。

## 小结

现在，你已经了解了expr要怎么编写来实现过渡效果了。我还实现了一些其它效果，包括示例里的，你可以在GitHub上[查看](https://github.com/jifengg/ffmpeg-script/tree/main/preset/xfade)。

## 性能

在windows下创建2个bat文件，分别输入测试命令：

```bat
@echo off
@REM 使用custom实现slideleft效果
ffmpeg -y -hide_banner ^
-f lavfi -i "pal100bars=r=1/1000" ^
-f lavfi -i "colorchart=r=1/1000" ^
-filter_complex ^
[0:v]format=yuv420p,scale=960:480,fps=25,trim=duration=40[v1];^
[1:v]format=yuv420p,scale=960:480,fps=25,trim=duration=40.04[v2];^
[v1][v2]xfade=duration=40:offset=0:transition=custom:^
expr='if(lt(X/W,P),^
if(eq(PLANE,0),a0(X+(1-P)*W,Y),^
if(eq(PLANE,1),a1(X+(1-P)*W,Y),^
if(eq(PLANE,2),a2(X+(1-P)*W,Y),0)))^
,^
if(eq(PLANE,0),b0(X-P*W,Y),^
if(eq(PLANE,1),b1(X-P*W,Y),^
if(eq(PLANE,2),b2(X-P*W,Y),0)))^
)' ^
-crf 23 -c:v h264 -pix_fmt yuv420p -movflags +faststart -r 25 -aspect 960:480 ^
out1.mp4
```

```bat
@echo off
@REM 使用内置的slideleft效果
ffmpeg -y -hide_banner ^
-f lavfi -i "pal100bars=r=1/1000" ^
-f lavfi -i "colorchart=r=1/1000" ^
-filter_complex ^
[0:v]format=yuv420p,scale=960:480,fps=25,trim=duration=40[v1];^
[1:v]format=yuv420p,scale=960:480,fps=25,trim=duration=40.04[v2];^
[v1][v2]xfade=duration=40:offset=0:transition=slideleft ^
-crf 23 -c:v h264 -pix_fmt yuv420p -movflags +faststart -r 25 -aspect 960:480 ^
out2.mp4
```

这里使用的动画时长是40秒，可以自行修改成0~60秒。  
在我电脑上运行，耗时分别是：自定义`17.514秒`,内置`1.605秒`。  
可以看出，使用自定义的效果，远比内置效果更耗时。原因我们在“[理解 expr](#理解-expr)”有提过，因为每一帧需要调用expr次数=960×480×3=1,382,400。一百多万次。而且是纯CPU运算，因此效率自然底下。

好在一般的过场时长是3、4秒左右，影响还在可接受范围内。

如果你在寻找更高效的自定义效果，可以考虑使用`xfade_opencl`过滤器，或者自行编译ffmpeg，加入`gl-transition`过滤器。

## 其它转场过滤器

### xfade_opencl

要使用`xfade_opencl`，需要编译的时候加入`--enable-opencl`，且运行的机器有支持opencl的设备（一般指显卡）。  
要查看当前机器有哪些opencl的设备，可以运行以下命令：
```
ffmpeg -v debug -init_hw_device opencl
```

打印出类似信息：
```
[AVHWDeviceContext @ 0000027894f28400] 1 OpenCL platforms found.
[AVHWDeviceContext @ 0000027894f28400] 1 OpenCL devices found on platform "NVIDIA CUDA".
[AVHWDeviceContext @ 0000027894f28400] 0.0: NVIDIA CUDA / NVIDIA GeForce RTX *****
```
其中`0.0`就是可用的opencl设备编号，在ffmpeg命令中指定使用该设备：

```
ffmpeg -y -hide_banner -init_hw_device opencl=ocldev:0.0 -filter_hw_device ocldev ^
-f lavfi -r 25 -t 40 -i "pal100bars" ^
-f lavfi -r 25 -t 40.04 -i "colorchart" ^
-filter_complex ^
[0:v]format=yuv420p,scale=960:480,hwupload[v0];^
[1:v]format=yuv420p,scale=960:480,hwupload[v1];^
[v0][v1]xfade_opencl=duration=40:offset=0:transition=slideleft,hwdownload,format=yuv420p ^
-c:v h264_nvenc -pix_fmt yuv420p -movflags +faststart -r 25 -aspect 960:480 ^
out3.mp4
```

性能比自定义xfade效果好很多，唯一要求就是需要支持opencl的设备（一般指显卡）。  
且，`xfade_opencl`也是支持自定义效果的，[官方文档](https://ffmpeg.org/ffmpeg-filters.html#xfade_005fopencl)。  
内置的几个效果的源码可以查看GitHub上ffmpeg的源码:[https://github.com/FFmpeg/FFmpeg/blob/master/libavfilter/opencl/xfade.cl](https://github.com/FFmpeg/FFmpeg/blob/master/libavfilter/opencl/xfade.cl)

### gl-transition

[gl-transitions](https://gl-transitions.com/)是由开发者 Gilles Lamothe 创建的，它封装了大量的GPU加速过渡效果，包括但不限于溶解、推拉、旋转等多种类型。这些过渡效果可以轻松地整合到你的图形应用程序中，无论你是开发游戏、视频编辑软件还是实验性的艺术项目。  
它使用OpenGL进行加速，因此，也需要支持OpenGL的设备（一般指显卡）。  
它不是ffmpeg专属的，但是可以做为一个过滤器添加到ffmpeg中。参考这个GitHub项目[transitive-bullshit/ffmpeg-gl-transition](https://github.com/transitive-bullshit/ffmpeg-gl-transition)。
编译后，你将可以使用其官网上的[所有效果](https://gl-transitions.com/gallery)，当然也可以自己编写自定义的效果。

性能方面，因为我没有自行编译测试，所以无法给出具体数据。

它使用GLSL语言编写，如果你看了上面OpenCL的部分，你会发现它们有很多共同点。  
甚至，我在编写`xfade`自定义表达式的时候，也参考了它的GLSL代码。比如效果预览中的[水滴](#水滴)，就是参考了[WaterDrop](https://gl-transitions.com/editor/WaterDrop)。  

## 结语

不知道是ffmpeg官方觉得xfade的expr编写太过容易，还是觉得性能不行不建议使用，反正官方文档及wiki都没有示例，也没有提及如何编写。  
我自己基本上是自己看着文档猜测、尝试，慢慢的摸索出来一些门道。想着网上没有一个类似的教程，于是变写了这个文章。  
如果你发现文章哪里有问题，欢迎指出，大家共同进步。  
