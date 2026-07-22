# 💒 婚礼音乐库 - BGM 管理 & 歌单制作

一站式婚礼仪式音乐管理工具：上传 MP3、浏览曲库、剪辑音频、制作歌单、导出 ZIP 压缩包。

## ✨ 功能

- **📚 音乐库** — 12 首预设婚礼仪式歌曲（灯光秀 → 退场），支持搜索/筛选
- **🛠️ 个人工作区** — 从曲库添加歌曲，自由剪辑、重命名，不影响原曲库
- **✂️ 音频剪辑器** — 可视化波形图，拖拽手柄选取起止点，实时预览
- **📦 ZIP 导出** — 一键导出工作区所有音频文件为压缩包
- **💾 离线可用** — 纯前端应用，无需服务器，IndexedDB 持久化

## 🚀 使用方式

### 本地使用
直接双击 `index.html` 打开，上传你的 MP3 文件即可。

### 在线部署（GitHub Pages）
1. Fork 本仓库
2. Settings → Pages → 选择 `main` 分支 → Save
3. 访问 `https://你的用户名.github.io/仓库名/`

## 📁 项目结构

```
├── index.html          # 主页面
├── css/style.css       # 样式
├── js/
│   ├── data.js         # 数据 + 文件存储 + WAV 编码
│   └── app.js          # 主逻辑 + 音频剪辑器
├── data/
│   ├── songs.json      # 歌曲元数据
│   └── audio/          # MP3 文件（12首婚礼音乐）
└── .gitignore
```

## 🎵 曲库内容

| Cue | 环节 | 歌曲 |
|-----|------|------|
| A | 灯光秀 | 暗灯 — 澤野弘之 |
| B | 主持人开场 | Through Different Eyes — CHPTRS |
| C | 新郎入场 | Through Different Eyes (副歌) |
| D | 新郎讲话 | Young and Beautiful (Inst.) |
| E | 新娘入场 | Young and Beautiful |
| F | 共同入场 | Bridal Chorus |
| G | 誓言 | Never Enough + Rewrite the Stars |
| H | 交换拥吻 | Never Enough |
| I | 父母入场 | FINAL FANTASY |
| J-1 | 举杯 | Come Alive (卡点34秒) |
| J-2 | 举杯 | Viva La Vida (伴奏版) |
| K | 退场 | The Greatest Show |

## 🛠️ 技术栈

纯前端：HTML + CSS + JavaScript  
- Web Audio API（音频解码/剪辑）
- IndexedDB（文件持久化）
- JSZip（ZIP 导出）
- Canvas（波形图绘制）
