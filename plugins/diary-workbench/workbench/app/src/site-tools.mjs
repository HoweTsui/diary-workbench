let current, registration;
export function installSiteTools(handlers) {
  current = handlers;
  if (registration || typeof document.modelContext?.registerTool !== 'function') return;
  registration = Promise.all([
    document.modelContext.registerTool({
      name: 'get_diary_generation_handoff', description: '读取已提交的日记任务及当前聊天接手指令；只读，不生图、不归档。先按指令读取完整日记 Skill，再使用内置 Imagegen，真实结果通过本地回写助手交回页面。',
      inputSchema: { type: 'object', properties: { taskId: { type: 'string' } }, required: ['taskId'], additionalProperties: false }, annotations: { readOnlyHint: true },
      execute: async ({ taskId }) => current.handoff(taskId),
    }),
    document.modelContext.registerTool({
      name: 'get_diary_workbench_state', description: '读取当前工作台的日期、事件、图片数量及真实生成任务状态。只读，不生成或归档。',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true },
      execute: async () => current.read(),
    }),
    document.modelContext.registerTool({
      name: 'generate_diary_day_preview', description: '将已填写的一天保存为等待当前聊天接手的任务。提交本身不生图、不归档；随后用 get_diary_generation_handoff 读取指令，在当前聊天按日记 Skill 调用 Imagegen 并回写真实结果。仅在用户要求生成时使用。',
      inputSchema: { type: 'object', properties: { date: { type: 'string', description: '已填写日期，YYYY-MM-DD' } }, required: ['date'], additionalProperties: false },
      execute: async ({ date }) => current.generate(date),
    }),
  ]).catch(() => { /* Ordinary browser controls remain usable without site tools. */ });
}
