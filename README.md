# 数学方法研究 · 开源阅读器

**[打开线上演示](https://cheng-bai.github.io/math-methods-companion/)**

把数学讲义组织为「全书板块 → 主题 → 细题型 → 完整例题 → 解析与方法笔记」。
这是独立的静态阅读器发布仓库，不是私人题库的公开镜像，也不是全高中考点已经完成的声明。

## 现在能读什么

- 12个板块、45讲的目录元数据，清楚显示当前主题在全书的位置。
- 目录可按章节编号、标题和板块多词筛选；这与仅检索自编题的演示搜索分开，目录项仍不提供未公开正文。
- 三个板块共13道自编例训，提供教师、学生两版：基本不等式5题、函数4题、数列4题；共6对同型例训可互跳，另有1道独立演示。函数含区间最值与计根，数列含参数递推与裂项求和。
- [226张编者知识速查](https://cheng-bai.github.io/math-methods-companion/knowledge.html)：按12板块、80个教材节主题组织，支持主题跳转、板块/多词筛选、卡片直达与相关讲目录定位。知识卡对应既有登记入口，含合并标题和编者细化标签；不代表课程知识、题型或配套练习已完整覆盖。
- 可展开的细题型导航、题号直达、题型回跳、搜索和版本切换。
- 本地 KaTeX 公式与字体，无 CDN 运行依赖；可离线直接打开 `dist/index.html`。
- 解析按需渲染，首次阅读不生成闭合解析的全部公式；索引首次检索才加载。
- 知识卡首次展开才加载本地公式引擎和字体；关闭的卡片不排版。资源加载失败可重新展开重试，禁用JavaScript时仍可读文字与公式源码。

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

公开输入显式列出；目录、知识卡、例训及其关联均有字段白名单，不从私人书稿目录自动复制。新增公开讲须登记到 `scripts/publications.py`，不自动发现目录里的其他文件：

| 文件 | 用途 |
| --- | --- |
| `content/catalog.json` | 章节编号、标题、板块三个字段，不能放入原题正文或来源路径 |
| `content/demo.json` | 基本不等式自编例训，保持DEMO-01原路径及旧锚点 |
| `content/functions.json` | 函数自编例训DEMO-02，完整条件、答案、证明与边界检查 |
| `content/sequences.json` | 数列自编例训DEMO-06，递推、求和及参数边界 |
| `content/knowledge.json` | 已复核的编者知识概括及目录位置，不含原题、原图、源文件路径或本地回源账本 |
| `content/example-links.json` | 已复核的知识卡与公开题关联，仅卡ID、讲ID、题ID、对应动作 |
| `assets/` | 阅读样式、交互与本地 KaTeX；不含私人题图 |
| `scripts/build.py` | 静态生成与链接、锚点、学生答案隔离检查 |
| `tests/browser.cjs` | 桌面／手机浏览器交互测试 |
| `tests/knowledge.cjs` | 知识卡筛选、深链接、按需公式、加载失败重试及无JS阅读测试 |

数学源码用标准 LaTeX，行内 `$...$`，独立公式 `$$...$$`。分数使用 `\frac` 或 `\dfrac`，
不要把斜线分数的自动猜测替换当作数学审校。修改示例后，应重新核算答案与达到性。

知识卡按「板块 → 教材节主题 → 知识条目」逐级定位。主题导航会清除阻挡目标的旧筛选；
教材节主题ID由教材节编号生成，不随显示标题或卡片排序变化。卡片ID发布后须保持稳定。
知识卡是重点概括，不代表该教材节已完整讲授、公式穷尽或已有完整配套题族。

每道题必须设置永久稳定的 `type_id`（小写字母开头，只含小写字母、数字、连字符；`map` 为保留值）。
题型按 `type_family`、`type_title` 两级归组：同一大类下标题相同的题目并入同一细题型，
不同大类中即使标题相同也分别归类。每道题的「题型入口」指向所属细题型，细题型列出所有对应题号。
同一细题型须共享同一个 `type_id`，不同题型不能复用 ID；`type_note` 应保持一致，展示时采用该组第一题的说明。
题型锚点由 `type_id` 生成，不随排序变化；变更标题时保留原 ID。题号使用 Q 加数字，大小写归一后须在本讲内唯一；跨讲关联始终使用讲ID与题ID组成身份，不能仅凭题号猜测目标。
已公开的数字题型旧锚点通过 `legacy_type_anchors` 持续映射，删除或重命名类型时须先处理已有链接。

浏览器测试需要 Node.js 20+（CI 使用22），是开发依赖，不会发送到读者端：

```sh
npm ci
npx playwright install chromium
python3 scripts/build.py
python3 tests/grouping.py
python3 tests/publications.py
python3 tests/example_links.py
node tests/publications.cjs
node tests/example_links.cjs
node tests/extensions.cjs
node tests/browser.cjs
node tests/knowledge.cjs
# 对线上版本运行相同交互检查：
PUBLIC_BASE_URL=https://cheng-bai.github.io/math-methods-companion/ node tests/browser.cjs
PUBLIC_BASE_URL=https://cheng-bai.github.io/math-methods-companion/ node tests/knowledge.cjs
```

已有本机浏览器时可设 `CHROMIUM_PATH`，已有 Playwright 包时可设 `PLAYWRIGHT_MODULE`，不必重复安装。
测试输出与截图不加入发布仓库。结构和公式渲染通过不等于数学、出处或版权审定。

## 部署

推送到 `main` 后，GitHub Actions 安装 Pandoc、构建、运行真实浏览器测试，
**只上传 `dist/`** 到 GitHub Pages。构建和测试失败不会进入部署。
所有资源使用相对路径，适配项目子路径，不要求根域名。

## 授权与隐私边界

- 本仓库作者代码、自编教学演示、编者知识卡与目录元数据按 MIT 许可证提供。
- KaTeX 0.16.47 及其字体保留上游许可证，见 `assets/katex/LICENSE` 和 `THIRD_PARTY.md`。
- 私人版的原题、原图、学生资料、来源文件、本机路径、映射账本和归档 PDF **均不在公开输入中**。
- 开源代码的许可证不赋予第三方原题或原图的再传播权。后续增加公开题目必须逐项确认来源与传播许可。
- 无分析统计、广告、远程字体、登录和内容上传接口。GitHub Pages 仍按其平台政策处理访问日志。
- 首页搜索状态会写入 URL，关键词可能出现在浏览器历史或分享链接中。
- 知识卡筛选同样保存在URL中；公开页面只含编者概括，参考沪教版2020版教材目录与本地稿，不是教材逐字摘录、现行考试要求或全高中覆盖证明。

## 公式验收语义

章节 `data-ready=true` 表示初始可见公式和交互已就绪，不表示闭合解析已全部审查。
调用 `window.BookMath.renderAll()` 可强制渲染全部公式；还须核对
`BookMath.rendered === BookMath.total` **且** `BookMath.errors.length === 0`。
打印前会补齐公式，但保持当前解析折叠状态；需要答案时先点「展开全部解析」。

### 知识卡与例训双向导航

`content/example-links.json` 单独记录已复核的卡ID、讲ID、题ID和对应动作，不依据关键词自动配题，不接受外部URL或私有路径字段。当前16条关联连接8张知识卡和12道自编例训；其中“不等式的性质”只关联作差判号子动作，不代表知识点覆盖。裂项题Q204暂无直接知识卡，不硬贴到等差等比求和；知识卡无关联并不等于该题没有方法。知识卡可直达教师版或学生版，题目可返回知识卡。学生版保留方法提示，不含答案解析。

新增验证：`python3 tests/example_links.py`、`node tests/example_links.cjs`（支持 `PUBLIC_BASE_URL` 线上复测）。导航为静态链接，不增加网络依赖；无JavaScript时可手动展开卡片后跳转，公式排版仍需JavaScript。
