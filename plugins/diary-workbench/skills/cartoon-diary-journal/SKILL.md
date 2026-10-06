---
name: cartoon-diary-journal
description: 把日记整理为原创黑白角色卡、表情动作预览与3:4日记海报，并兼容本地人物图谱和离线日记本。
---

# 原创黑白日记

把用户日记、照片和角色信息整理为原创角色卡、3:4日记海报、人物关系图谱与离线日记本。完整原文保留在 `sourceText`；全部场景照片的主要内容整合进最多5行，不自动选5张丢弃其余。相同事件可融合，不同动作可用独立留白插画同排一行；每天只交付一张海报。没有场景照片时按文字选择1–5个场景。

## 固定流程

所有人物与动物的头部、身体必须按参考图侧向展示，绝对禁止正面，不保留背影例外；人物保留双眼可见的参考侧向画法。此硬性要求覆盖角色卡、表情、动作、新海报与旧图增补，交付逐角色目视核验。

开始时复用用户已保存的笔记工具/日记目录和日记本位置；未指定时只补问保存目标，先推进不依赖目标的整理。最终交付同时包含“目标笔记软件中的当天正文”和“对应 3D 日记本中的同日海报”。执行记录及交付核验见 `references/task-delivery.md`；不能把本地预览或仅生成文件称为已同步。

日常任务的用户可见新增仅为一张当天海报、对应日期的正文/已有两种日记本配图，以及有新角色时原人物关系图谱HTML的数据增补。复用已确认角色，无变化不重做角色卡或图谱；不重建HTML外壳、封面、3D/翻页效果或前端工程。直接运行安装目录中的脚本；brief、请求、合板等中间文件放在目标日记目录与Git仓库之外的临时工作区，不复制脚本、测试、依赖或工程到用户任务。仅存必要证据，收尾清理无用试错副本，细则见 task-delivery.md。

默认风格入口：每次阅读 `references/style-contract.md` 和 `references/style-lock.md`。已确认母版对所有新任务自动生效，不要求用户开启 styleLock；旧参考包不再默认使用。母版已批准与实验模板未批准分别管理，不自动批准草稿模板。

组件复用与动作库见 `references/component-reuse.md`：角色专属已确认动作优先直接复用，只等比缩放和平移。六个示例动作可供参考画法，但不能冒充用户身份；真实角色缺少匹配动作时，实际附上母版和角色卡生成单场景，不退回旧风格整页重画。

1. 阅读 `references/prompt-template.md`、`references/style-system.md`、`references/identity-fidelity.md`、`references/visual-gate.md`。生成人物时，生成器必须实际附上已批准母版及 identity-fidelity.md 中列出的全部角色组件参考；任何缺图、错配或可见身份/风格/表情偏差都不能验收为完成。
2. 用户提供照片时，先运行 `scripts/archive_diary_photos.py`：保留原件、另存长边2048px/质量85的JPEG，并让 brief 的 `origin: "user-photo"` 指向压缩件和归档清单。逐张整理主要内容，全部场景照片均参与海报；身份来源单独声明用途。阅读 `references/photo-integration.md`，不因数量筛掉照片，不把用户照片放入 Skill 的固定参考包。
3. 新角色或旧角色卡画风不匹配时，用 `onboarding + --preview` 按母版校准人物卡。每角色单独生成一张 1:1 正方形、完整半侧面全身标准图；只出现该角色一次，不附放大的头脸细节，不生成多角度或重复全身。用 `build_character_avatar.py` 从同一张图自动裁出完整头部至肩部，等比居中导出独立 1:1 头像，禁止另行生图头像，详见 `references/character-library.md`。每个角色分别对应用户上传图像/已确认身份卡，逐项记录可见脸型、发型、年龄呈现、体型、服装及配饰锚点；按组件参考校准，不照搬示例角色整体。鼻形、鼻根断口、眼睛结构和比例按当前母版与 geometry 修正，不沿用旧卡的错误几何。新人物草稿档案录入图谱；未知关系不猜。用户确认该版本后记录 approvedVersion、approvedBy 和 `identity.styleVersion=style-lock-v2`，正式海报复用。待确认角色可用于明确标注的整页预览，不能替用户批准。
4. 写 brief，保留原文，明确每幅独立插画的动作重点和角色，用 `posterRows` 分组到最多5行。`role: "scene"` 图片必须有唯一 `id`，由事件的 `referenceIds` 显式引用；超过5张场景参考用 `photoCoverage` 记录全部主要内容和插画落点，不能用仅归档代替海报覆盖。身份卡用 `characterIds` 限定角色，旧共享卡兼容。映射见 `references/prompt-template.md` 和 `references/photo-integration.md`。每幅用 `scripts/build_diary_prompt.py --scene N --request-output request-N.json` 自动导出符合附件预算的实参；母版首张独立，其余必要来源可合板，清单全部实际附上，保存调用和参考板清单。`--output` 与 request 的 `prompt` 完全一致；用 `scripts/preflight_check.py --brief ... --requests ...` 核对。角色比例唯一以 `references/geometry.json` 为准。
5. 每次生成一张**无文字、无纸张横线、透明背景**的独立场景。沿用母版侧向五官，场景自然留白，只画必要道具；禁止矩形背景、齐边截断和连续小分镜。逐张查看五官与完整边缘，再用 `scripts/build_diary_template.py --scenes ... --config ... --output-dir ...` 按全部 events 顺序、posterRows 分组完整等比合成最多5行与悠哉文字。插画数可多于5，不与行数混淆，不虚构不同事件同时发生。行备注按实际墨迹中心定位；顶部与右侧安全区保护，无竖线或白板。不得硬裁人物或去白；逐张对照照片主要内容是否实际覆盖。
6. 有新角色/用户确认的变化才增补原人物图谱的数据块，保留其他角色、布局与交互；无变化只核对复用。将同一张正式海报按日期补入用户已有日记本与3D日记本，保留同日ID、不制造重复条目；已存在的阅读器只更新数据和图片，不重建载体或替换runtime。v3使用 `scripts/build_diary_reader.py <已更新数据的旧书HTML> --output-dir <现有v3目录> --update-date YYYY-MM-DD`；首次建书才使用导出/构建器。缺失日期继续只留日期空白。旧版兼容见 `references/diary-book-system.md`。
7. 阅读 `references/diary-document.md`，将完成文字合成的 PNG 压缩后直接嵌入对应日期日记正文，不能只交付链接。正文按“日记内容 → 完整海报 → 全部原照片三列宫格”排列，照片按输入顺序、用压缩件、不裁切。原件与高清海报保留，压缩后重新解码并对照检查异常变黑、空白、方向或失真。按目标工具的原生嵌图语法入库并实际预览；本地可用 `scripts/build_diary_document.py`。日记本汇编不能替代正文入库。

沿用以上七步，每步保存实际产物或调用证据到任务 `run.json`，交付前运行 `scripts/verify_diary_delivery.py run.json`。缺少笔记入库、日记本对应日期或实际预览证据就报告未完成项；脚本不伪造用户批准，也不声称能监控 Agent 的全部行为。

日记正文可轻润色语序、错别字和标点；正文及海报标题、备注、场景须逐条对照 `sourceText`，保留事实、因果、否定、情绪强度和用户立场，不新增情节或强行升华。字数限制不能成为改变原意的理由。

## 按任务查阅

- 修改旧海报、补充/替换元素：必须先读 `references/poster-revision.md`。当前画风同样约束旧图修改；旧图只作内容/构图参考，人物与动物都不能沿袭旧画法。
- 新角色/外观校准：`references/character-library.md`、`references/character-features.md`、`references/identity-fidelity.md`；扩展索引在 `assets/style-reference/character-extension-v1/library.json`。每次含人类角色的生图都必须实际附上头脸母版、外观变化、年龄/体型、开放式组合、四肢与手脚比例、24种正式表情参考，并按角色 ID 限定；必须另附对应角色的用户来源图或已确认身份卡。所有参考按声明的组件用途逐张使用，不复制参考图中的完整角色。
- 新动作/素材复用：`references/component-reuse.md`；当前动作索引 `assets/style-reference/style-lock-v1/action-library-v3.json`，逐项区分批准与示例草稿；旧动作仅存档。
- 照片整合/表情/排版：`references/photo-integration.md`、`references/prompt-template.md`、`references/visual-atoms.md`、`references/page-layouts.md`。
- 入库/同步/验收：`references/diary-document.md`、`references/task-delivery.md`、`references/diary-reader-v3.md`、`references/qa-checklist.md`；旧书兼容才查 `references/diary-book-system.md`。

正式生图要求 `identity.status=confirmed`、`version=approvedVersion`、`approvedBy=user` 和 `identity-approved` 图片。脚本不替用户作审批；替换正式资产或推送仓库仍要取得本次任务明确授权。

## 字体、颜色与图像质量

右侧备注默认 44px、标题48px、日期32px（1200px 宽画布，其他尺寸等比），字号统一由 `assets/templates/diary-poster-text-layout.json` 维护。长备注换行，禁止靠缩小字体塞入；超出安全区则调整表达或场景位置。场景以完整可见主体适配分配区域，只可略去外围完全透明的空白，不裁掉任何着色像素、身体白色填充或抗锯齿边缘，避免把大片透明画布当成主体导致图形过小。

每个人物必须复用一处小面积纯黑主色块，逐角色与整页分别遵守黑墨目标≤20%、硬上限30%；眼珠/口腔不能替代主色块。人物、道具线条等粗，每一开放端点为半圆封口、无渐细尖尾；非人物/动物道具用外轮廓与少量结构线，允许必要局部断点。所有姿势的裸露臂腿同宽、极细双线，手鞋大小不变。详见 `references/style-contract.md` 和 `references/character-features.md`。12人参考 v5 与四肢组件 v2 保持原批准版本，不擅自重画用户历史日记。

所有海报文字、关系图谱和两种日记本都使用 Skill 随附的 **悠哉 / Yozai**，运行环境不依赖设备安装字体。只使用白底、黑色墨线和浅青横线；浅青只用于横线。黑色实墨目标不超过画面20%，硬上限30%；3D翻页可有干净、轻微的中性灰投影，不能形成脏纹理。保留充足分辨率和正常平滑抗锯齿：最终海报、图谱与日记本屏幕显示都不能出现明显锯齿；禁止最近邻放大、硬边量化和刻意像素化。

运行：
```bash
python3 scripts/build_diary_prompt.py task-output/brief.json --preview --scene 1 --request-output task-output/request-01.json --output task-output/prompt-01.txt
python3 scripts/preflight_check.py --brief task-output/brief.json --preview
python3 scripts/check_poster_ink.py task-output/poster.png
python3 -m unittest discover -s tests
```

日记逐场替换 `--scene N` 和输出文件名；角色卡不带 `--scene`。不带请求导出的多事件提示词仅供规划，不能直接生图。正式模式省略 `--preview`。出图后按 `references/visual-gate.md` 与 `references/qa-checklist.md` 逐项检查身份、动作、文字安全区、颜色比例、字体、完整边界和正常缩放下的平滑度。预览未获用户认可前不得替换正式资产。隐私与原创边界见 `references/privacy-originality.md`。
