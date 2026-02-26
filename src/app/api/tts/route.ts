import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from 'fs';
import path from 'path';
import { synthesizeSpeechXfyun } from '@/lib/xfyun-tts';

const SETTINGS_FILE = path.join(process.cwd(), 'settings.json');

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

    // 1. 尝试读取设置并检查讯飞TTS配置
    let settings: any = {};
    try {
        const data = await fs.readFile(SETTINGS_FILE, 'utf-8');
        settings = JSON.parse(data);
    } catch (e) {
        // settings file not found or error
    }

    // 优先使用讯飞TTS
    if (settings.xfyunAppId && settings.xfyunApiSecret && settings.xfyunApiKey) {
        try {
            const audioBuffer = await synthesizeSpeechXfyun(
                text, 
                settings.xfyunAppId, 
                settings.xfyunApiSecret, 
                settings.xfyunApiKey
            );
            const base64Audio = audioBuffer.toString('base64');
            return NextResponse.json({
                success: true,
                audio: base64Audio,
                format: "mp3"
            });
        } catch (xfyunError: any) {
            console.error("Xfyun TTS Error:", xfyunError);
            // Fallback to next method (ZAI or Native)
        }
    }

    // 2. 如果没有讯飞配置，直接返回 fallback 让前端使用浏览器原生 TTS
    // 我们不再使用 z-ai-web-dev-sdk
    return NextResponse.json({ 
      success: false, 
      error: "未配置TTS服务，将使用浏览器原生语音",
      fallback: true
    }, { status: 200 });

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
