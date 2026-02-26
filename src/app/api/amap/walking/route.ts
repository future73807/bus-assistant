import { NextRequest, NextResponse } from "next/server";

// 步行路径规划API - 计算步行距离和时间
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { origin, destination, key } = body;

    if (!origin || !destination) {
      return NextResponse.json({ 
        success: false, 
        error: "请提供起点和终点" 
      }, { status: 400 });
    }

    // 如果没有配置key，返回模拟数据
    if (!key) {
      return NextResponse.json({
        success: true,
        data: generateMockWalkingRoute(origin, destination),
        isDemo: true,
        message: "使用演示数据"
      });
    }

    // 调用高德地图步行路径规划API
    const url = new URL("https://restapi.amap.com/v3/direction/walking");
    url.searchParams.set("key", key);
    url.searchParams.set("origin", origin);
    url.searchParams.set("destination", destination);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status !== "1") {
      return NextResponse.json({ 
        success: false, 
        error: data.info || "步行路径规划失败" 
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: data,
      isDemo: false
    });

  } catch (error) {
    console.error("步行路径规划错误:", error);
    return NextResponse.json({ 
      success: false, 
      error: "服务暂时不可用，请稍后再试" 
    }, { status: 500 });
  }
}

// 生成模拟步行路径数据
function generateMockWalkingRoute(origin: string, destination: string) {
  // 计算两点之间的直线距离（简化计算）
  const [lng1, lat1] = origin.split(',').map(Number);
  const [lng2, lat2] = destination.split(',').map(Number);
  
  // 简化的距离计算（实际应该使用Haversine公式）
  const distance = Math.sqrt(Math.pow((lng2 - lng1) * 111000, 2) + Math.pow((lat2 - lat1) * 111000, 2));
  const duration = Math.round(distance / 1.4); // 假设步行速度1.4米/秒
  
  return {
    route: {
      origin: origin,
      destination: destination,
      distance: Math.round(distance).toString(),
      duration: duration.toString(),
      steps: [
        {
          instruction: "步行前往目的地",
          road: "",
          distance: Math.round(distance).toString(),
          duration: duration.toString(),
          action: "步行",
          assistant_action: ""
        }
      ]
    }
  };
}
