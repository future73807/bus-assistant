import { NextRequest, NextResponse } from "next/server";

// 周边搜索API - 搜索附近的公交站点
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { location, keywords, radius, key } = body;

    if (!location) {
      return NextResponse.json({ 
        success: false, 
        error: "请提供位置信息" 
      }, { status: 400 });
    }

    // 如果没有配置key，返回模拟数据
    if (!key) {
      return NextResponse.json({
        success: true,
        data: generateMockNearbyStops(location, keywords),
        isDemo: true,
        message: "使用演示数据"
      });
    }

    // 调用高德地图周边搜索API
    const url = new URL("https://restapi.amap.com/v3/place/around");
    url.searchParams.set("key", key);
    url.searchParams.set("location", location);
    url.searchParams.set("keywords", keywords || "公交站|地铁站");
    url.searchParams.set("radius", radius || "1000");
    url.searchParams.set("offset", "10");
    url.searchParams.set("page", "1");
    url.searchParams.set("extensions", "all");

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status !== "1") {
      return NextResponse.json({ 
        success: false, 
        error: data.info || "周边搜索失败" 
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: data,
      isDemo: false
    });

  } catch (error) {
    console.error("周边搜索错误:", error);
    return NextResponse.json({ 
      success: false, 
      error: "服务暂时不可用，请稍后再试" 
    }, { status: 500 });
  }
}

// 生成模拟周边站点数据
function generateMockNearbyStops(location: string, keywords?: string) {
  const [lng, lat] = location.split(',').map(Number);
  
  // 根据关键词生成不同的站点
  const isSubway = keywords?.includes('地铁');
  
  return {
    pois: [
      {
        id: "B000A83K8J",
        name: isSubway ? "地铁站A" : "公交站A",
        type: isSubway ? "地铁站" : "公交站点",
        typecode: isSubway ? "150500" : "150700",
        address: "北京市朝阳区XX路",
        location: `${lng + 0.001},${lat + 0.001}`,
        pname: "北京市",
        cityname: "北京市",
        adname: "朝阳区",
        distance: "300",
        tel: "",
        rating: "4.5",
        cost: "",
        navio_poiid: "",
        navilocation: "",
        navientrance: "",
        businfo: isSubway ? "地铁1号线" : "6路、10路、15路"
      },
      {
        id: "B000A83K8K",
        name: isSubway ? "地铁站B" : "公交站B",
        type: isSubway ? "地铁站" : "公交站点",
        typecode: isSubway ? "150500" : "150700",
        address: "北京市朝阳区YY路",
        location: `${lng - 0.002},${lat + 0.001}`,
        pname: "北京市",
        cityname: "北京市",
        adname: "朝阳区",
        distance: "500",
        tel: "",
        rating: "4.2",
        cost: "",
        navio_poiid: "",
        navilocation: "",
        navientrance: "",
        businfo: isSubway ? "地铁2号线" : "8路、20路"
      },
      {
        id: "B000A83K8L",
        name: isSubway ? "地铁站C" : "公交站C",
        type: isSubway ? "地铁站" : "公交站点",
        typecode: isSubway ? "150500" : "150700",
        address: "北京市朝阳区ZZ路",
        location: `${lng + 0.003},${lat - 0.002}`,
        pname: "北京市",
        cityname: "北京市",
        adname: "朝阳区",
        distance: "800",
        tel: "",
        rating: "4.0",
        cost: "",
        navio_poiid: "",
        navilocation: "",
        navientrance: "",
        businfo: isSubway ? "地铁10号线" : "25路、30路"
      }
    ]
  };
}
