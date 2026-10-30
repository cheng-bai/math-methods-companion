# 第三方组件

## KaTeX 0.16.47

- 上游：https://github.com/KaTeX/KaTeX
- 许可证：MIT，完整文本随资源保存于 `assets/katex/LICENSE`。
- 文件：`katex.min.js`、`katex.min.css`、`fonts/*.woff2`。
- 本仓库只自托管运行所需资源，不加载远端脚本或字体。
- 系统中文字体只作 CSS 字体选择，不随仓库再分发。

## Pandoc

构建时调用系统 Pandoc，不随站点分发，不属于浏览器运行时依赖。
上游：https://pandoc.org/ ，许可证由其发行版提供。

## Playwright

仅为浏览器开发测试依赖，不随站点分发。上游：https://playwright.dev/ ，Apache-2.0。
