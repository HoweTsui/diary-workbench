const key = value => String(value || '').normalize('NFKC').trim().toLocaleLowerCase();
export function protagonist(nodes, explicit) {
  if (explicit && nodes.some(n => n.id === explicit)) return explicit;
  const matches = nodes.filter(n => n.role === '日记主角');
  return matches.length === 1 ? matches[0].id : null;
}
export function matchCharacter(character, nodes) {
  const exact = nodes.find(n => n.id === character.id);
  const names = new Set([character.name, ...(character.aliases || [])].map(key).filter(Boolean));
  const matches = nodes.filter(n => [n.name, ...(n.aliases || [])].some(name => names.has(key(name))));
  if (exact) return exact;
  if (matches.length > 1) throw Error(`角色“${character.name}”有多个同名或别名匹配，请明确身份。`);
  return matches[0] || null;
}
export function relationshipKnown(graph, id, narrator) {
  const saved = graph.nodes.find(n => n.id === id)?.profile?.relationshipToProtagonist;
  return id === narrator || graph.edges.some(e => (e.source === narrator && e.target === id) || (e.target === narrator && e.source === id)) || !!(saved?.confirmedAt && saved.protagonistId === narrator);
}
function relationshipType(label) {
  if (/恋人|伴侣|女朋友|男朋友|妻子|丈夫/.test(label)) return 'partner';
  if (/宠物|猫|狗|照顾|陪伴/.test(label)) return 'care';
  if (/朋友|同学|室友/.test(label)) return 'friend';
  if (/同事|老板/.test(label)) return 'work';
  if (/爸|妈|父|母|奶奶|爷爷|姥|外公|外婆|兄|弟|姐|妹|儿|女|亲人/.test(label)) return 'family';
  return 'other';
}
export function confirmRelationships(graph, characters, narrator, answers = []) {
  if (!Array.isArray(answers)) throw Error('关系确认资料无效。');
  const seen = new Set();
  for (const answer of answers) {
    if (!characters.some(c => c.id === answer.id) || answer.id === narrator || seen.has(answer.id) || !['confirmed', 'unknown'].includes(answer.status) || (answer.status === 'confirmed' && (typeof answer.label !== 'string' || !answer.label.trim() || answer.label.length > 40))) throw Error('关系确认资料无效。');
    seen.add(answer.id);
  }
  for (const c of characters) {
    if (narrator && !relationshipKnown(graph, c.id, narrator) && !seen.has(c.id)) throw Error(`请确认${c.name}与主角的关系，或选择暂不确定。`);
  }
  return answers.map(a => ({ id: a.id, status: a.status, label: a.status === 'confirmed' ? a.label.trim() : '' }));
}
export function mergeRelationships(graph, approval, narrator) {
  let changed = false;
  for (const answer of approval.relationships || []) {
    const node = graph.nodes.find(n => n.id === answer.id);
    if (!node || !narrator || !graph.nodes.some(n => n.id === narrator) || node.id === narrator) continue;
    node.profile ||= {};
    node.profile.relationshipToProtagonist = { protagonistId: narrator, status: answer.status, label: answer.label, confirmedAt: approval.at, confirmedBy: approval.by };
    changed = true;
    if (answer.status !== 'confirmed') continue;
    const exists = graph.edges.some(e => ((e.source === narrator && e.target === node.id) || (e.target === narrator && e.source === node.id)) && e.label === answer.label);
    if (!exists) graph.edges.push({ source: narrator, target: node.id, label: answer.label, type: relationshipType(answer.label), curve: 0, confirmedBy: approval.by, confirmedAt: approval.at });
  }
  return changed;
}

export const characterInstructions = `生成前自动检索 input.json 的 characters 目录：按稳定 id、姓名、aliases 和角色关系匹配，日记中的“我”只对应 protagonistId。匹配已存在者必须沿用 id；旧画风、缺头像或换装不等于新增角色。同名冲突先澄清，不能以照片外观另建重复角色。只有目录不存在者才新增。头像与身份卡是不同资产：每个新建/更新身份的角色，先用 onboarding + --preview 生成1:1单角色全身标准图（不得附加头脸细节），再用 build_character_avatar.py 从同一张图自动裁出完整头部至肩部并水平垂直居中的独立1:1头像；禁止另画头像，brief.characters 对应项加入 avatar（相对 brief 文件的 PNG 路径）。头像只出现该角色一次，水平和垂直居中，透明外部与纯白内部；不可用整张卡、多人合图、全身或双头细节卡充当头像。已有当前规范独立头像可直接复用 input.characters.avatar。逐张实际看图，并在 visualReview 中核对。角色与主角的关系由预览页用户确认，绝不自行推断归档关系。`;
