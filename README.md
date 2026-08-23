# JP MAHJONG

`jpmahjong.org` 的网页版原型：玩家对战 AI、和纸牌谱视觉、2.5D 牌桌。

## 0.3.0 功能

- 玩家作为东家，对战三位电脑雀士
- 电脑雀士会根据向听数和有效进张自动摸切
- 不提供 AI 教练、实时提示或推荐切牌
- 按选定概念图重构的米白和纸牌桌、深靛牌墙、八角计分盘与四方名牌
- 标准 136 张四人麻将牌山
- 自摸和牌形判定与荒牌流局
- 默认收缩的牌局侧栏
- 每日何切与 5 题入门闯关
- 浏览器本地保存答题进度
- 桌面与手机响应式布局

当前版本暂不包含吃碰杠、立直、荣和、符番计分与牌谱回放。这些会在后续版本逐步加入。

## 本地运行

```powershell
npx serve .
```

然后访问终端显示的 HTTP 地址。项目使用 ES Modules，不能直接通过 `file://` 双击打开。

## 测试

```powershell
npm test
```

## 素材与许可

代码采用 MIT License。麻将牌 SVG 来自 FluffyStuff/riichi-mahjong-tiles，原项目声明为 Public Domain，来源与许可记录位于 `assets/tiles/`。
