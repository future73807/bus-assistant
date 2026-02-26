import { NextRequest, NextResponse } from "next/server";

// 高德地图搜索API - 整合了关键字搜索(POI)和地理编码
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address, city, key, location } = body; // location: "lng,lat"

    if (!address) {
      return NextResponse.json({ 
        success: false, 
        error: "请输入地址" 
      }, { status: 400 });
    }

    // 如果没有配置key，返回模拟数据
    if (!key) {
      // 模拟北京地区的坐标
      const mockLocations: Record<string, { location: string; formatted_address: string; name?: string }> = {
        "天安门": { location: "116.397428,39.90923", formatted_address: "北京市东城区天安门", name: "天安门" },
        "北京站": { location: "116.426759,39.903738", formatted_address: "北京市东城区北京站", name: "北京站" },
        "西单": { location: "116.374181,39.913531", formatted_address: "北京市西城区西单", name: "西单" },
        "王府井": { location: "116.41029,39.918058", formatted_address: "北京市东城区王府井", name: "王府井" },
        "国贸": { location: "116.458537,39.909536", formatted_address: "北京市朝阳区国贸", name: "国贸" },
        "中关村": { location: "116.311351,39.975464", formatted_address: "北京市海淀区中关村", name: "中关村" },
        "西直门": { location: "116.354059,39.940682", formatted_address: "北京市西城区西直门", name: "西直门" },
        "东直门": { location: "116.434531,39.944551", formatted_address: "北京市东城区东直门", name: "东直门" },
        "三里屯": { location: "116.454365,39.932286", formatted_address: "北京市朝阳区三里屯", name: "三里屯" },
        "望京": { location: "116.481728,40.001936", formatted_address: "北京市朝阳区望京", name: "望京" },
      };

      // 尝试匹配模拟数据
      const matchedKey = Object.keys(mockLocations).find(k => address.includes(k));
      
      if (matchedKey) {
        return NextResponse.json({
          success: true,
          data: {
            geocodes: [{
              formatted_address: mockLocations[matchedKey].formatted_address,
              location: mockLocations[matchedKey].location,
              name: mockLocations[matchedKey].name,
              level: "公交站点",
              adcode: "110000"
            }]
          },
          isDemo: true,
          message: "使用演示数据"
        });
      }

      // 默认返回北京市中心坐标
      return NextResponse.json({
        success: true,
        data: {
          geocodes: [{
            formatted_address: `北京市${address}`,
            location: "116.397428,39.90923",
            name: address,
            level: "公交站点",
            adcode: "110000"
          }]
        },
        isDemo: true,
        message: "使用演示数据"
      });
    }

    // 优先使用关键字搜索 (Place Search API)
    // 它可以返回更准确的POI结果，并且支持周边搜索
    const placeUrl = new URL("https://restapi.amap.com/v3/place/text");
    placeUrl.searchParams.set("key", key);
    placeUrl.searchParams.set("keywords", address);
    placeUrl.searchParams.set("offset", "10"); // 返回前10条
    placeUrl.searchParams.set("page", "1");
    placeUrl.searchParams.set("extensions", "all");

    if (city) {
      placeUrl.searchParams.set("city", city);
      // 如果没有提供location，则限制在城市内搜索
      if (!location) {
         placeUrl.searchParams.set("citylimit", "true");
      }
    }

    // 如果提供了当前位置，使用它来优化排序
    if (location) {
      placeUrl.searchParams.set("location", location);
      placeUrl.searchParams.set("sortrule", "distance"); // 按距离排序
    }

    const placeResponse = await fetch(placeUrl.toString());
    const placeData = await placeResponse.json();

    if (placeData.infocode === "10001") {
       return NextResponse.json({ 
        success: false, 
        error: "无效的API Key，请检查配置" 
      }, { status: 400 });
    }

    // 如果POI搜索有结果，直接返回并适配格式
    if (placeData.status === "1" && placeData.pois && placeData.pois.length > 0) {
      // 映射 pois 到 geocodes 格式，以保持前端兼容性
      const geocodes = placeData.pois.map((poi: any) => ({
        formatted_address: `${poi.pname}${poi.cityname}${poi.adname}${poi.address}`,
        location: poi.location,
        name: poi.name, // 添加名称字段
        level: poi.type,
        adcode: poi.adcode,
        city: poi.cityname
      }));

      return NextResponse.json({
        success: true,
        data: {
          geocodes: geocodes
        },
        isDemo: false
      });
    }

    // 如果POI搜索没结果，降级使用地理编码API (Geocode API)
    // 适用于输入的是纯地址而非POI名称的情况
    const geoUrl = new URL("https://restapi.amap.com/v3/geocode/geo");
    geoUrl.searchParams.set("key", key);
    geoUrl.searchParams.set("address", address);
    if (city) {
      geoUrl.searchParams.set("city", city);
    }

    const geoResponse = await fetch(geoUrl.toString());
    const geoData = await geoResponse.json();

    if (geoData.status !== "1") {
      return NextResponse.json({ 
        success: false, 
        error: geoData.info || "搜索失败" 
      }, { status: 400 });
    }

    // 如果地理编码也没结果，尝试移除城市限制重试（针对某些跨城市搜索或模糊地址）
    if (geoData.geocodes?.length === 0 && city) {
      const retryUrl = new URL("https://restapi.amap.com/v3/geocode/geo");
      retryUrl.searchParams.set("key", key);
      retryUrl.searchParams.set("address", address); // 不带city参数
      
      const retryResponse = await fetch(retryUrl.toString());
      const retryData = await retryResponse.json();
      
      if (retryData.status === "1" && retryData.geocodes?.length > 0) {
         // 为结果添加 name 字段（使用格式化地址作为名称）
         retryData.geocodes.forEach((g: any) => g.name = g.formatted_address);
         return NextResponse.json({
          success: true,
          data: retryData,
          isDemo: false
        });
      }
    } else if (geoData.geocodes?.length > 0) {
       // 为结果添加 name 字段
       geoData.geocodes.forEach((g: any) => g.name = g.formatted_address);
    }

    return NextResponse.json({
      success: true,
      data: geoData,
      isDemo: false
    });

  } catch (error) {
    console.error("搜索错误:", error);
    return NextResponse.json({ 
      success: false, 
      error: "服务暂时不可用，请稍后再试" 
    }, { status: 500 });
  }
}
