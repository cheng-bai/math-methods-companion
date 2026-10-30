# 数学方法研究 · 开源阅读器

**[打开线上演示](https://cheng-bai.github.io/math-methods-companion/)**

把数学讲义组织为「全书板块 → 主题 → 细题型 → 完整例题 → 解析与方法笔记」。
这是独立的静态阅读器发布仓库，不是私人题库的公开镜像，也不是全高中考点已经完成的声明。

## 现在能读什么

- 12个板块、45讲的目录元数据，清楚显示当前主题在全书的位置。
- 基本不等式的自编教学演示，提供教师、学生两版。
- 可展开的细题型导航、题号直达、题型回跳、搜索和版本切换。
- 本地 KaTeX 公式与字体，无 CDN 运行依赖；可离线直接打开 `dist/index.html`。
- 解析按需渲染，首次阅读不生成闭合解析的全部公式；索引首次检索才加载。

**45讲正文没有在这个仓库公开。**目录项明确标记「正文暂未公开」，没有虚假的可读链接。
示例仅用于体验阅读器，不构成中偏难练习集、完整题型体系或考试要求。
学生版不含答案解析，但保留方法分类提示，不是无提示测试卷。

## 运行与修改

依赖 Python 3.10+ 和 [Pandoc](https://pandoc.org/installing.html)。不需要数据库、前端框架或账号。

```sh
python3 scripts/build.py
# 直接用浏览器打开 dist/index.html；或启动本机服务器：
python3 -m http.server 8000 --bind 127.0.0.1 --directory dist
```

输入只有两份明确的公开内容：

| 文件 | 用途 |
| --- | --- |
| `content/catalog.json` | 章节编号、标题、板块三个字段，不能放入原题正文或来源路径 |
| `content/demo.json` | 自编演示的题干、答案、解析、取等检查、方法笔记与细题型 |
| `assets/` | 阅读样式、交互与本地 KaTeX；不含私人题图 |
| `scripts/build.py` | 静态生成与链接、锚点、学生答案隔离检查 |
| `tests/browser.cjs` | 桌面／手机浏览器交互测试 |

数学源码用标准 LaTeX，行内 `$...$`，独立公式 `$$...$$`。分数使用 `\frac` 或 `\dfrac`，
不要把斜线分数的自动猜测替换当作数学审校。修改示例后，应重新核算答案与达到性。

每道题必须设置永久稳定的 `type_id`（小写字母开头，只含小写字母、数字、连字符；`map` 为保留值）。
题型按 `type_family`、`type_title` 两级归组：同一大类下标题相同的题目并入同一细题型，
不同大类中即使标题相同也分别归类。每道题的「题型入口」指向所属细题型，细题型列出所有对应题号。
同一细题型须共享同一个 `type_id`，不同题型不能复用 ID；`type_note` 应保持一致，展示时采用该组第一题的说明。
题型锚点由 `type_id` 生成，不随排序变化；变更标题时保留原 ID。题号使用 Q 加数字，大小写归一后必须唯一。
已公开的数字题型旧锚点通过 `legacy_type_anchors` 持续映射，删除或重命名类型时须先处理已有链接。

浏览器测试需要 Node.js 20+（CI 使用22），是开发依赖，不会发送到读者端：

```sh
npm ci
npx playwright install chromium
python3 scripts/build.py
python3 tests/grouping.py
node tests/browser.cjs
# 对线上版本运行相同交互检查：
PUBLIC_BASE_URL=https://cheng-bai.github.io/math-methods-companion/ node tests/browser.cjs
```

已有本机浏览器时可设 `CHROMIUM_PATH`，已有 Playwright 包时可设 `PLAYWRIGHT_MODULE`，不必重复安装。
测试输出与截图不加入发布仓库。结构和公式渲染通过不等于数学、出处或版权审定。

## 部署

推送到 `main` 后，GitHub Actions 安装 Pandoc、构建、运行真实浏览器测试，
**只上传 `dist/`** 到 GitHub Pages。构建和测试失败不会进入部署。
所有资源使用相对路径，适配项目子路径，不要求根域名。

## 授权与隐私边界

- 本仓库作者代码、自编教学演示与目录元数据按 MIT 许可证提供。
- KaTeX 0.16.47 及其字体保留上游许可证，见 `assets/katex/LICENSE` 和 `THIRD_PARTY.md`。
- 私人版的原题、原图、学生资料、来源文件、本机路径、映射账本和归档 PDF **均不在公开输入中**。
- 开源代码的许可证不赋予第三方原题或原图的再传播权。后续增加公开题目必须逐项确认来源与传播许可。
- 无分析统计、广告、远程字体、登录和内容上传接口。GitHub Pages 仍按其平台政策处理访问日志。
- 首页搜索状态会写入 URL，关键词可能出现在浏览器历史或分享链接中。

## 公式验收语义

章节 `data-ready=true` 表示初始可见公式和交互已就绪，不表示闭合解析已全部审查。
调用 `window.BookMath.renderAll()` 可强制渲染全部公式；还须核对
`BookMath.rendered === BookMath.total` **且** `BookMath.errors.length === 0`。
打印前会补齐公式，但保持当前解析折叠状态；需要答案时先点「展开全部解析」。
