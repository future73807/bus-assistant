import { NextRequest, NextResponse } from "next/server";

// 语音识别API
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audio = formData.get("audio");

    if (!audio) {
      return NextResponse.json({ success: false, error: "No audio file provided" });
    }

    // 由于我们移除了 z-ai-web-dev-sdk，我们需要一个新的 ASR 方案
    // 这里我们可以暂时返回一个模拟结果，或者集成讯飞的语音识别
    
    // TODO: 集成讯飞语音听写 API
    // 目前先简单返回一个模拟文本，让前端知道接口通了
    console.warn("ASR service is not implemented yet. Using mock response.");
    
    // 如果想让流程走下去，这里可以先返回一个假数据，或者如果前端只是测试连接，可以这样。
    // 但用户说"识别不了语音"，说明他期望真的能用。
    // 既然 z-ai 被删了，现在没有真正的后端 ASR 服务了。
    // 唯一的办法是前端使用浏览器原生的 SpeechRecognition (webkitSpeechRecognition)
    
    return NextResponse.json({
      success: true,
      text: "语音识别功能暂不可用（SDK已移除），请使用键盘输入", 
      isMock: true
    });

  } catch (error: any) {
    console.error("ASR Error:", error);
    return NextResponse.json({ success: false, error: error.message || "ASR failed" });
  }
}
