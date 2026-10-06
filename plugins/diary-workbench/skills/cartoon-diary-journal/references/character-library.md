# 人物图库与关系

照片到画法的对应规则见 `character-features.md`：先提取每人发型、轮廓、眼镜等，再映射到当前母版；不能把所有人变成相同短发示例。特征图索引在 `assets/style-reference/character-features-v1/library.json`，草稿参考只用于预览，不代替用户身份批准。

新图brief的characters使用精确id、name、species和身份anchors，protagonistId不得靠列表首项推断。角色卡与表情按style-system.md及geometry.json构造，每个角色使用自己的物种尺寸。

每次写日记/生成海报前先检索当前图谱，按稳定 id、姓名、aliases 和已知关系复用角色；“我”只映射明确 protagonistId/日记主角。缺新画风卡、缺头像、换衣服不构成新增；只有目录不存在才建新角色，同名/别名冲突需要澄清，不能猜测合并。预览页对新增或缺关系角色询问“该角色是主角的什么人/宠物”，允许明确选择暂不确定；确认后才保存关系及连线，未知不画边。关系确认独立于形象审批，不由模型替用户批准，也不因共同出镜推断关系。

新角色先以identity-source和--preview生成draft人物形象卡：每个角色单独生成一张 1:1 正方形完整半侧面全身标准图，只出现同一角色一次，不附放大的头脸细节，不生成多角度、转面图或重复全身；人类双眼可见，头部与身体遵循当前母版侧向画法。来源照片的朝向不改变出图朝向，组件合板不作为待生成人物名单。卡片保留从输入照片/文字提取的可观察锚点（发型、眼镜、服装、耳尾等），第一张附件始终为当前已确认母版。旧画风角色卡先按母版校准，不能继承错误五官。用户确认卡片的当前版本后才记录confirmed、approvedVersion、approvedBy=user和identity.styleVersion=style-lock-v2；之后正式海报直接复用该身份版本，不逐篇重新确认。图谱status=actual仅说明实际数据，不代表用户审批。

日常默认复用现有角色，不因制作一篇日记就重做全体人物/宠物图册。新角色才将节点、独立头像、标准卡引用与已知关系增补到原HTML的 graph-data 块及已有数据源；保持其他节点/边、位置、界面、交互和字体不变。用户未提供的关系不添加；没有新角色/变化则不改图谱。首次建图才使用下述全量构建命令，不能用它重写用户已有的定制HTML载体。

图谱兼容assets/templates/character-graph-data.example.json和原build_character_graph.py接口：atlas.src/cols/rows；nodes的id/name/role/col/row/x/y/anchors；edges的source/target/label/type/curve。新节点可带profile：approval 为 draft 或 approved、appearance 为固定外观列表、standardCardSrc 为相对图谱的标准卡图片、firstAppearance 为首次出现的日记说明。右侧详情以“新角色草稿”或“可用于正式成品”展示，避免抽象状态名。图谱anchors仍至少四条；brief允许两条起步，入图库前补齐实际可见特征。不借用模板人物。仅记录用户提供或确认的关系；未说明的关系不画边、不猜标签。

avatarSrc相对HTML；每个节点使用独立1:1头像。先生成1:1单角色全身标准图，再运行 `python3 scripts/build_character_avatar.py full-body.png --output avatar.png --species human` 自动裁出完整头部至肩部，并等比缩放、补透明留白，水平和垂直居中。宠物用cat/dog，保留完整耳朵与头部至上胸。必须查看裁剪结果；默认比例不适合该角色时用 `--shoulder-y` 指定源图肩部下沿后重新导出，不另行生成头像。不得裁头发、耳朵或脸；头像不含腰腿，不把全身缩小塞进圆框。该裁剪只用于头像，不能裁切海报场景。保留源图、独立头像与 `.crop.json` 裁剪清单，源图哈希可追溯；`profile.standardCardSrc` 指全身图，`avatarSrc` 指头像，二者不能同文件/同哈希。旧图谱可回退atlas，新角色必须走此链路。按原接口构建：
```bash
python3 scripts/build_character_graph.py character-data.json --output character-graph.html
```
裁剪细则：不得切掉头顶、耳朵或脸；长发在肩部下沿自然截断，不为保留发梢而把腰部带进头像。抬高的宠物尾巴若进入默认裁剪区域，查看源图后用 `--head-box LEFT TOP RIGHT BOTTOM` 指定完整头肩区域，排除尾巴，不重绘角色。仅更新旧角色头像时保留原身份审批与旧标准卡；新全身图可记入 `profile.avatar.fullBodySrc`，作为可追溯的头像裁剪源，不冒充已获用户批准的新身份版本。
命令在HTML旁创建`fonts/Yozai-*.ttf`和OFL许可，图谱离线统一使用悠哉字体。图谱浏览/编辑、搜索、拖拽、关系、localStorage与?character=<ID>跳转保持原接口。日记本兼容规则见diary-book-system.md。
