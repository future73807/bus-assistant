import { NextRequest, NextResponse } from "next/server";

// TTS语音合成API
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, speed = 0.8 } = body;

    if (!text) {
      return NextResponse.json({ 
        success: false, 
        error: "请输入要合成的文本" 
      }, { status: 400 });
    }

    // 使用动态导入，防止模块初始化时的错误导致整个路由崩溃
    // 同时包裹在try-catch中，确保任何错误都能降级处理
    try {
      // 尝试导入 ZAI SDK
      const zaiModule = await import('z-ai-web-dev-sdk');
      const ZAI = zaiModule.default || zaiModule;
      
      const zai = await ZAI.create();
      
      const response = await zai.audio.speech.create({
        input: text,
        model: "tts-1",
        voice: "alloy",
        speed: speed,
      });

      // 获取音频数据
      const audioBuffer = await response.arrayBuffer();
      const base64Audio = Buffer.from(audioBuffer).toString('base64');

      return NextResponse.json({
        success: true,
        audio: base64Audio,
        format: "mp3"
      });
    } catch (zaiError: any) {
      // 捕获 ZAI 初始化或调用错误，包括 "Configuration file not found"
      // console.warn("ZAI TTS failed, switching to client fallback:", zaiError.message);
      
      // 返回 200 状态码和 fallback 标志，让前端使用浏览器原生 TTS
      return NextResponse.json({ 
        success: false, 
        error: "TTS服务暂不可用",
        fallback: true
      }, { status: 200 }); 
    }

  } catch (error) {
    // 捕获所有其他错误（如 JSON 解析失败等）
    console.error("TTS General Error:", error);
    // 即使是未知错误，也尝试让前端降级
    return NextResponse.json({ 
      success: false, 
      error: "语音合成失败",
      fallback: true
    }, { status: 200 });
  }
}
