# 为图片或视频添加自定义的水印，具有动态水印等多种高级功能。

- [效果预览](#效果预览)
- [前言](#前言)
- [技术分析](#技术分析)
  - [运动路径：模拟DVD待机画面](#运动路径模拟dvd待机画面)
  - [设置透明度](#设置透明度)
  - [水印填充](#水印填充)

## 效果预览

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


## 前言

给图片或视频增加水印，这是一个很常见的功能。在ffmpeg里，其实就是一个`overlay`画面叠加的过滤器。  
这个过滤器的x、y值支持表达式，于是可以在表达式上根据播放进度t来动态计算x、y值，实现动态水印。  
而如果是要叠加文本，则是用`drawtext`过滤器，它是直接在画面上绘制文本，同时x、y也支持表达式。  

通过动态算法，可以实现很多有趣的效果，比如模拟DVD待机画面、每n秒随机变换水印位置等。

## 技术分析

### 运动路径：模拟DVD待机画面

从上面效果预览可以看到，这个运动是一个匀速运动，会在画面内有类似“回弹”的效果。  
这个可以做个拆解，水平方向x轴的运动，和垂直方向y轴的运动。  
只要实现了一个方向的往复运动，两个方向同时运动即可达到预想效果。  

> 先了解：视频宽度W，水印宽度w，为了让水印在水平运动有触底回弹的效果，因此x轴最小为0，最大则为W-w。

#### 方法一：绝对值和取余函数

一开始我尝试了取余函数`mod(t,W-w)`，但是这个效果是，水印运动到最右边之后，会立刻在最左边出现。并没有“回来”的效果。  
我们可以在“数字帝国”这个网站上看到[函数图（x%10）](https://zh.numberempire.com/graphingcalculator.php?functions=x%2510&xmin=0&xmax=100&ymin=-40&ymax=40&var=x)

> 假设W-w=10，其中x轴表示时间

![image](https://github.com/jifengg/ffmpeg-script/assets/17020523/19e13c56-20bd-45a5-93a4-44b4fad7a9b1)

不过，通过函数图我们可以看到，y值从0到10，如果函数变成 x%10-10/2，也就是减去最大值的一半，则有一半会变成负数：

> x%10-5

![image](https://github.com/jifengg/ffmpeg-script/assets/17020523/fd88e459-d0f1-4467-987c-0cc154b95e7e)

如果，再对y值取绝对值，那负数就可以变成正数了：

> abs(x%10-5)

![image](https://github.com/jifengg/ffmpeg-script/assets/17020523/c9b4ccba-8d7b-4024-9fe7-20b18aec9107)

等等，x=0的时候，y=5，还需要将函数图整体`向左移动5`,才能使得x=0时，y=0

> abs((x+5)%10-5)

![image](https://github.com/jifengg/ffmpeg-script/assets/17020523/f030e263-090a-4b2c-af7b-fa3262b77a8a)

我们希望得到一个在0和n之间回弹的函数，那么就是`abs((x+n)%(2*n)-n)`，我这里不把n提取出来，是因为要设置初始坐标、移动速度等都是以像素为单位，只需要修改函数里x的初始值及倍数即可。例如初始坐标100，速度是每秒移动200像素，那么就用`abs((100+200*x+n)%(2*n)-n)`即可，其中x表示时间，单位秒。


#### 方法二：正弦与反正弦函数

> 注意，这里三角函数里的值用的是`弧度`，而不是`角度`；

后来我又想起来，数学里有名的正弦函数sin(x)，它的函数图就是一个波浪形的曲线：

![image](https://github.com/jifengg/ffmpeg-script/assets/17020523/2a872804-200c-4f04-afc7-1e23d695c04c)

只不过，它不是一个线性变化的曲线，如果直接用它来表示x轴的运动，会有加速减速的效果，且模拟出来的就不是回弹的效果了。  
因此，需要有什么手段把函数图的曲线变成直线。  
此时，可以再加一个反正弦函数，变成`asin(sin(x))`，就会发现，当x取值在(0,2𝜋)时，y值在(-0.5𝜋,0.5𝜋)之间线性变化。
因此，如果我们希望得到一个x取值(0,1)和(1,2)时，y值从0到1，再从1到0的一个函数，就改成`asin(sin((x-0.5)*pi))/pi+0.5`

![image](https://github.com/jifengg/ffmpeg-script/assets/17020523/11330d9f-e3ce-4dd6-ad7c-2ae013557db4)

虽然这个函数可以达到回弹的效果，但是涉及到要设置初始位置、运动速度时，公式就会变得比较麻烦，所以，目前在ffmpeg里我采用了第一种方式来实现。

### 设置透明度

本次学习到了2种“使画面变半透明”的方法。分别是[geq](https://ffmpeg.org/ffmpeg-filters.html#geq)和[colorchannelmixer](https://ffmpeg.org/ffmpeg-filters.html#colorchannelmixer)过滤器。  
不过要注意使用这个过滤器之前要保证画面是argb格式的，因此还需要经过[format](https://ffmpeg.org/ffmpeg-filters.html#format-1)转换一次。  
以下两种方式均演示了把输入画面的透明度设置为50%：

```shell
[1:v]format=argb,geq=a='0.5*alpha(X,Y)'[out1]
[1:v]format=argb,colorchannelmixer=aa=0.5[out1]
```

### 水印填充

ffmpeg本身没有提供类似背景填充的功能，需要我们自己实现。  
我们可以在脚本里计算好需要填充的数量及相应的位置，然后一个个通过overlay叠加上去。  
但是我们可以变换一种思路，先把水印通过`hstack`过滤器水平拼接m个，再把水平拼接好的通过`vstack`过滤器垂直拼接n个，这样就可以把水印填充成mxn的大小。再通过`rotate`旋转指定的角度后，和原画面进行叠加。  
脚本这里假设不知道原画面的大小，于是填充了一张`足够大`的图来进行叠加。

