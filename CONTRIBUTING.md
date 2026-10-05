# 开发与发布

此仓库只维护默认版，禁止提交个人 workspace.json、照片、日记、生成任务或浏览器数据。

运行 `node scripts/verify-default.mjs` 检查默认数据、清单及包哈希。工作台源码在 `plugins/diary-workbench/workbench/app`，可在该目录执行 `npm ci` 和 `npm run build`。

日记规范以上游 cartoon-diary-journal 为源。更新 bundled Skill 时同步完整资源并检查哈希，不分别维护两套画风规则。

发布前同时更新两种插件清单版本，执行 `node scripts/verify-default.mjs --refresh-report` 重建文件清单（此命令不会上传任何文件），再执行普通校验。运行 `python3 scripts/package-release.py` 生成 marketplace ZIP 和独立 plugin ZIP。发行包默认是空库，截图仅使用空白界面或明确虚构测试内容。

提交代码前运行 `git diff --check`。新功能请区分“构建通过”“首次安装通过”和“真实生图归档通过”，没有执行的验证不要写成成功。
