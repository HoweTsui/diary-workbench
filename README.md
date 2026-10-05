# 日记工作台 / Diary Workbench

在 Codex 桌面端的右侧浏览器里填写事件与照片，将生成任务交给当前聊天，预览海报并确认归档。包含 3D 日记本、人物关系图谱及原创黑白日记 Skill。

**v0.1.9 · 公开试用版。默认没有日记、角色、照片，也没有连接任何个人笔记库。**

![默认空白工作台](docs/default-workbench.png)

## 安装到 Codex

需要 Node.js 22+、npm、Python 3（含 Pillow）、已登录的本地 Codex，以及支持图片生成的当前聊天环境。

```sh
codex plugin marketplace add HoweTsui/diary-workbench --ref v0.1.9
```

然后在桌面应用的插件目录中选择「日记工作台」安装；必要时重启应用，在新对话中说：**打开日记工作台**。

这是 GitHub 安装源，不是 OpenAI 官方公共目录上架。官方教程：[插件打包和安装源](https://developers.openai.com/plugins/build/plugins)。

也可下载 [Releases](https://github.com/HoweTsui/diary-workbench/releases) 中的 marketplace ZIP，解压后运行 `codex plugin marketplace add /绝对路径/marketplace`。插件 ZIP 是独立插件包，不是 marketplace 根目录。

## 如何使用

1. 选择日期，逐件填写内容并上传图片；粘贴图片前先选中对应事件的输入框。
2. 点击生成预览。普通 localhost 页面需要复制生成指令，在左侧当前聊天发送；不是点击后自动启动隐藏任务。
3. 当前聊天读取插件内 Skill，完成真实图片生成、合成和检查。回传成功后，右侧展示成品。
4. 确认海报和角色后归档，再进入 3D 日记本阅读。

首次启动会安装锁定的 npm 依赖。默认服务只监听本机 `127.0.0.1:8185`。本地页面不是托管网站，安装插件也不代表网页端 ChatGPT 能运行本机服务。

## 本地开发和运行

```sh
git clone https://github.com/HoweTsui/diary-workbench.git
cd diary-workbench
node scripts/verify-default.mjs
node plugins/diary-workbench/scripts/start.mjs
```

打开启动日志中的本地地址。需要单独安装 Pillow 时，可创建 Python 虚拟环境、安装 `Pillow`，并将 `DIARY_PYTHON` 指向该环境的 Python。HEIC/HEIF 预览在 macOS 使用系统解码；其他系统还需要相应编解码支持（如 pillow-heif）。

可选环境变量：`DIARY_PYTHON`、`DIARY_CODEX_PATH`、`DIARY_WORKBENCH_PORT`、`DIARY_WORKBENCH_DATA`。

## 数据与隐私

私有资料保存在用户数据目录的 `diary-workbench-default` 中，与插件代码分开。默认不会扫描或自动连接 Obsidian。已有库需用户指定并核实目录及格式；参见 [隐私与数据说明](docs/PRIVACY.md)。

发行包中的插画是 Skill 的通用画风与虚构示例参考，不是默认用户身份或用户日记；不能把示例人物当成新用户本人。

## 与原 Skill 的关系

[cartoon-diary-journal](https://github.com/HoweTsui/cartoon-diary-journal) 保留独立使用入口。本插件包含一份固定版本的完整 Skill；画风规范以上游为源，工作台负责交互和流程。该快照版本及资源哈希见 `package-report.json`，上游本地修订不一定已发布到原仓库。

## 当前验证范围

已检查默认空库、发布包隐私扫描、清单一致性、依赖安装、服务启动及前端构建。macOS 是当前实测平台；Windows/Linux 和新用户端到端图片生成仍需试用反馈。不得将构建通过当成所有用户都已完成生图与归档。

[发行说明](CHANGELOG.md) · [贡献与发布](CONTRIBUTING.md) · [官方目录准备状态](docs/OFFICIAL-DIRECTORY.md)

项目代码使用 MIT；字体、翻页库及其他依赖保留各自许可，见插件内的第三方声明。
