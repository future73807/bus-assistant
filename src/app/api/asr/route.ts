import { NextRequest, NextResponse } from "next/server";
import ZAI from 'z-ai-web-dev-sdk';

// 语音识别API
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;

    if (!audioFile) {
      return NextResponse.json({ 
        success: false, 
        error: "请提供音频文件" 
      }, { status: 400 });
    }

    // 使用z-ai-web-dev-sdk进行语音识别
    const zai = await ZAI.create();
    
    // 将音频文件转换为base64
    const audioBuffer = await audioFile.arrayBuffer();
    const base64Audio = Buffer.from(audioBuffer).toString('base64');

    const response = await zai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      language: "zh",
    });

    const transcribedText = response.text;

    return NextResponse.json({
      success: true,
      text: transcribedText
    });

  } catch (error) {
    console.error("语音识别错误:", error);
    return NextResponse.json({ 
      success: false, 
      error: "语音识别失败，请稍后再试" 
    }, { status: 500 });
  }
}
