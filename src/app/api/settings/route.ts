import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from 'fs';
import path from 'path';

const SETTINGS_FILE = path.join(process.cwd(), 'settings.json');

interface Settings {
  amapKey?: string;
  apihzId?: string;
  apihzKey?: string;
  busKey?: string;
  xfyunAppId?: string;
  xfyunApiSecret?: string;
  xfyunApiKey?: string;
  [key: string]: string | undefined;
}

// 读取设置
export async function GET() {
  try {
    const data = await fs.readFile(SETTINGS_FILE, 'utf-8');
    const settings: Settings = JSON.parse(data);
    return NextResponse.json({
      success: true,
      settings: settings
    });
  } catch {
    // 文件不存在，返回空设置
    return NextResponse.json({
      success: true,
      settings: {}
    });
  }
}

// 保存设置
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { amapKey, apihzId, apihzKey, busKey, xfyunAppId, xfyunApiSecret, xfyunApiKey } = body;

    const settings: Settings = { 
      amapKey, 
      apihzId, 
      apihzKey, 
      busKey,
      xfyunAppId,
      xfyunApiSecret,
      xfyunApiKey
    };
    
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2));

    return NextResponse.json({
      success: true,
      message: "设置已保存"
    });
  } catch (error) {
    console.error("保存设置错误:", error);
    return NextResponse.json({ 
      success: false, 
      error: "保存设置失败" 
    }, { status: 500 });
  }
}
