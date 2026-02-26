import { NextRequest, NextResponse } from "next/server";

// 高德地图逆地理编码API - 坐标转地址（获取城市）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { location, key } = body;

    if (!location) {
      return NextResponse.json({ 
        success: false, 
        error: "请输入坐标" 
      }, { status: 400 });
    }

    // 如果没有配置key，返回模拟数据
    if (!key) {
      return NextResponse.json({
        success: true,
        data: {
          regeocode: {
            addressComponent: {
              city: "北京市"
            },
            formatted_address: "北京市天安门"
          }
        },
        isDemo: true,
        message: "使用演示数据"
      });
    }

    // 调用高德地图API
    const url = new URL("https://restapi.amap.com/v3/geocode/regeo");
    url.searchParams.set("key", key);
    url.searchParams.set("location", location);
    url.searchParams.set("extensions", "base");

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status !== "1") {
      return NextResponse.json({ 
        success: false, 
        error: data.info || "逆地理编码失败" 
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: data,
      isDemo: false
    });

  } catch (error) {
    console.error("逆地理编码错误:", error);
    return NextResponse.json({ 
      success: false, 
      error: "服务暂时不可用，请稍后再试" 
    }, { status: 500 });
  }
}
