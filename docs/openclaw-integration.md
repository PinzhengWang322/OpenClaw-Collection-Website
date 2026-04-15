# OpenClaw Integration Notes

这份仓库不包含真实可用的 Discord token，也不包含用户自己的 OpenClaw 配置；这里整理的是接入思路。

## Goal

目标很简单：

- 网站负责展示和本地维护内容
- OpenClaw 负责接收 Discord 里的自然语言请求
- agent 把这些请求翻译成对站点的实际操作

## Two Practical Ways To Drive The Site

### Option A: Use The Local CLI

优点：

- 最直接
- 不需要额外写一层集成代码
- 很适合 agent 在同一台机器上工作

典型命令：

```bash
npm --prefix website run collection:add -- ...
npm --prefix website run collection:update -- ...
npm --prefix website run collection:gallery:add -- ...
npm --prefix website run collection:delete -- ...
```

### Option B: Use The Write APIs

优点：

- 更容易和别的前端或自动化集成
- agent 不一定非要拼 CLI 参数

接口：

- `POST /api/items`
- `PATCH /api/items/:id`
- `POST /api/items/:id/gallery`
- `DELETE /api/items/:id`

写接口通过 `x-admin-password` 做轻量保护。

## Agent Behavior That Worked Well

这类卡片站，agent 的行为规则尽量简单清楚：

1. 先判断是新增、修改、删卡还是加图。
2. 如果用户只给了标题和少数字段，就按项目规则补齐一个合理首版。
3. 所有时间字段统一使用 `YY.MM`。
4. 改完立刻排序并持久化。
5. 回复保持短，不要把内部执行细节全抖出来。

## Sanitized Config Sketch

这里只给出占位形式，避免泄漏真实配置：

```json
{
  "channels": {
    "discord": {
      "token": "<DISCORD_BOT_TOKEN>"
    }
  }
}
```

真正重要的不是配置长什么样，而是 agent 拿到这个项目之后知道自己能做什么。

## Suggested Agent Prompt

可以给 agent 一段类似这样的项目规则：

```text
You are maintaining a local collection website.

- Use the project directory as the source of truth.
- For add/update/delete/image operations, prefer the local CLI or the write APIs.
- Keep time values in YY.MM format.
- Always keep categories sorted newest-first.
- Keep confirmations short after successful operations.
```

如果要接图片搜索，还可以再补一句：

```text
Prefer stable image sources or local assets. Do not store fragile hotlinks in the repo.
```

## Why This Pattern Is Interesting

很多 agent demo 停在“能聊天”这一步，但这个模式多走了一步：

- 有明确的本地数据模型
- 有真实可见的前端结果
- 有完整的 CRUD 工作流
- 有一个很容易理解的聊天入口

所以它既像一个个人项目，也像一个非常容易展示的 OpenClaw showcase。
