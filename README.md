# 🚌 老年人公交出行助手

一个专为老年人设计的公交查询应用，支持语音输入、路线规划和语音报站功能。

## 功能特点

- 🎤 **语音输入** - 说出起点终点，自动识别
- 🗺️ **真实数据** - 接入高德地图API获取真实公交数据
- 🔊 **语音报站** - TTS语音播报乘车指引
- 📱 **大字号界面** - 专为老年人设计
- 🔄 **演示模式** - 无需API Key也可体验

## 安装步骤

### 1. 创建新项目

```bash
npx create-next-app@latest bus-assistant --typescript --tailwind --eslint
cd bus-assistant
```

### 2. 安装依赖

```bash
npm install z-ai-web-dev-sdk
```

### 3. 复制文件

将 src 目录和配置文件复制到项目根目录：

```
src/app/
├── page.tsx          # 主页面
├── api/
│   ├── amap/
│   │   ├── geocode/route.ts   # 地理编码
│   │   ├── bus/route.ts       # 公交路线规划
│   │   ├── nearby/route.ts    # 周边站点搜索
│   │   └── walking/route.ts   # 步行路径规划
│   ├── tts/route.ts           # 语音合成
│   ├── asr/route.ts           # 语音识别
│   └── settings/route.ts      # 设置保存
├── globals.css
└── layout.tsx
```

### 4. 启动项目

```bash
npm run dev
```

### 5. 访问应用

打开浏览器访问: http://localhost:3000

## 配置高德地图API Key

1. 访问 [高德开放平台](https://lbs.amap.com/)
2. 注册并登录账号
3. 创建应用，选择"Web服务"
4. 获取API Key
5. 在应用中点击右上角设置按钮，输入Key

## 使用说明

1. **输入起点** - 点击麦克风，说出出发地点（如"天安门"、"我的位置"）
2. **输入终点** - 再次点击麦克风，说出目的地
3. **查看路线** - 系统显示2条最优公交路线
4. **语音报站** - 点击绿色按钮，听取详细乘车指引

## 演示模式

未配置API Key时，系统使用演示数据，支持以下地点：
- 天安门、北京站、西单、王府井
- 国贸、中关村、西直门、东直门
- 三里屯、望京

## 技术栈

- Next.js 15 + App Router
- TypeScript
- Tailwind CSS
- 高德地图API
- z-ai-web-dev-sdk (TTS/ASR)

## 注意事项

1. 语音功能需要浏览器授权麦克风权限
2. 建议使用Chrome、Edge等现代浏览器
3. 高德API Key需要开通"Web服务"权限
4. 生产环境请将设置保存到数据库而非文件

## License

MIT
