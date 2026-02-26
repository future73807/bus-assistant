import { NextRequest, NextResponse } from "next/server";

// 公交路线规划API
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { origin, destination, city, cityd, key } = body;

    if (!origin || !destination) {
      return NextResponse.json({ 
        success: false, 
        error: "请输入起点和终点" 
      }, { status: 400 });
    }

    // 如果没有配置key，返回模拟数据
    if (!key) {
      return NextResponse.json({
        success: true,
        data: generateMockBusRoutes(origin, destination),
        isDemo: true,
        message: "使用演示数据"
      });
    }

    // 调用高德地图公交路线规划API
    const url = new URL("https://restapi.amap.com/v3/direction/transit/integrated");
    url.searchParams.set("key", key);
    url.searchParams.set("origin", origin);
    url.searchParams.set("destination", destination);
    if (city) {
      url.searchParams.set("city", city);
    }
    // 如果没有cityd（终点城市），默认使用city（起点城市）
    if (cityd) {
      url.searchParams.set("cityd", cityd);
    } else if (city) {
      url.searchParams.set("cityd", city);
    }
    
    url.searchParams.set("strategy", "0"); // 推荐策略
    url.searchParams.set("nightflag", "0");
    url.searchParams.set("date", new Date().toISOString().split('T')[0]);
    url.searchParams.set("time", new Date().toTimeString().slice(0, 5).replace(':', ''));

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status !== "1") {
      // 尝试不带city参数重试
      const retryUrl = new URL("https://restapi.amap.com/v3/direction/transit/integrated");
      retryUrl.searchParams.set("key", key);
      retryUrl.searchParams.set("origin", origin);
      retryUrl.searchParams.set("destination", destination);
      retryUrl.searchParams.set("strategy", "0");
      retryUrl.searchParams.set("nightflag", "0");
      retryUrl.searchParams.set("date", new Date().toISOString().split('T')[0]);
      retryUrl.searchParams.set("time", new Date().toTimeString().slice(0, 5).replace(':', ''));
      
      const retryResponse = await fetch(retryUrl.toString());
      const retryData = await retryResponse.json();
      
      if (retryData.status === "1" && retryData.route?.transits?.length > 0) {
        // Transform the data structure before returning
        transformRouteData(retryData.route);
        return NextResponse.json({
          success: true,
          data: retryData,
          isDemo: false
        });
      }

      return NextResponse.json({ 
        success: false, 
        error: data.info || "路线规划失败" 
      }, { status: 400 });
    }

    // Transform the data structure before returning
    transformRouteData(data.route);

    return NextResponse.json({
      success: true,
      data: data,
      isDemo: false
    });

  } catch (error) {
    console.error("公交路线规划错误:", error);
    return NextResponse.json({ 
      success: false, 
      error: "服务暂时不可用，请稍后再试" 
    }, { status: 500 });
  }
}

// Transform Amap Integrated Transit data structure to flat steps
function transformRouteData(route: any) {
  if (!route || !route.transits) return;

  route.transits.forEach((transit: any) => {
    // Force re-transformation even if steps exist, as they might be from previous faulty logic
    // But keep mock data check if needed (mock data usually doesn't have segments)
    if (transit.steps && transit.steps.length > 0 && !transit.segments) return;

    const steps: any[] = [];
    
    if (transit.segments && Array.isArray(transit.segments)) {
      transit.segments.forEach((segment: any) => {
        // Handle Walking
        if (segment.walking && segment.walking.distance && parseInt(segment.walking.distance) > 0) {
          steps.push({
            instruction: `步行${segment.walking.distance}米`,
            distance: segment.walking.distance,
            duration: segment.walking.duration,
            walk_type: "步行", // Generic walk
            step_action: "步行"
          });
        }
        
        // Handle Bus
        // Check for both 'buslines' (plural) and potentially other structures
        if (segment.bus && segment.bus.buslines && Array.isArray(segment.bus.buslines) && segment.bus.buslines.length > 0) {
          // Take the first busline option
          const busline = segment.bus.buslines[0];
          steps.push({
            instruction: `乘坐${busline.name}`,
            distance: busline.distance,
            duration: busline.duration,
            line_name: busline.name,
            line_id: busline.id,
            via_num: busline.via_num,
            via_stops: busline.via_stops,
            departure_stop: busline.departure_stop,
            arrival_stop: busline.arrival_stop,
            step_action: "公交"
          });
        }
        
        // Handle Railway (Subway)
        if (segment.railway && segment.railway.name) {
             const railway = segment.railway;
             steps.push({
                instruction: `乘坐${railway.name}`,
                distance: railway.distance,
                duration: railway.time,
                line_name: railway.name,
                line_id: railway.id,
                via_num: railway.via_num,
                via_stops: railway.via_stops, 
                departure_stop: railway.departure_stop,
                arrival_stop: railway.arrival_stop,
                step_action: "地铁"
             });
        }
      });
    }
    
    // Assign the flattened steps to the transit object
    transit.steps = steps;
  });
}

// 生成模拟公交路线数据
function generateMockBusRoutes(origin: string, destination: string) {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();

  return {
    route: {
      origin: origin,
      destination: destination,
      transits: [
        {
          cost: {
            duration: "1800", // 30分钟
            transit_fee: "2",
            walking_distance: "500"
          },
          distance: "8500",
          walking_distance: "500",
          duration: "1800",
          nightflag: "0",
          night_duration: "",
          steps: [
            {
              distance: "300",
              duration: "300",
              instruction: "步行300米到公交站",
              road: "",
              step_action: "步行",
              walk_type: "起点步行"
            },
            {
              distance: "6000",
              duration: "1200",
              instruction: "乘坐6路公交车",
              line_name: "6路(火车站-西客站)",
              line_id: "BJ006",
              via_num: "8",
              via_stops: [
                { name: "第一站" },
                { name: "第二站" },
                { name: "第三站" },
                { name: "第四站" },
                { name: "第五站" },
                { name: "第六站" },
                { name: "第七站" },
                { name: "第八站" }
              ],
              departure_stop: { name: "起点站" },
              arrival_stop: { name: "终点站" }
            },
            {
              distance: "200",
              duration: "200",
              instruction: "步行200米到目的地",
              road: "",
              step_action: "步行",
              walk_type: "终点步行"
            }
          ]
        },
        {
          cost: {
            duration: "2100", // 35分钟
            transit_fee: "3",
            walking_distance: "350"
          },
          distance: "7800",
          walking_distance: "350",
          duration: "2100",
          nightflag: "0",
          night_duration: "",
          steps: [
            {
              distance: "150",
              duration: "150",
              instruction: "步行150米到公交站",
              road: "",
              step_action: "步行",
              walk_type: "起点步行"
            },
            {
              distance: "5500",
              duration: "1500",
              instruction: "乘坐地铁1号线",
              line_name: "地铁1号线(苹果园-四惠东)",
              line_id: "BJ001",
              via_num: "6",
              via_stops: [
                { name: "第一站" },
                { name: "第二站" },
                { name: "第三站" },
                { name: "第四站" },
                { name: "第五站" },
                { name: "第六站" }
              ],
              departure_stop: { name: "起点地铁站" },
              arrival_stop: { name: "换乘站" }
            },
            {
              distance: "2000",
              duration: "300",
              instruction: "换乘地铁2号线",
              line_name: "地铁2号线(内环)",
              line_id: "BJ002",
              via_num: "2",
              via_stops: [
                { name: "第一站" },
                { name: "第二站" }
              ],
              departure_stop: { name: "换乘站" },
              arrival_stop: { name: "终点地铁站" }
            },
            {
              distance: "200",
              duration: "200",
              instruction: "步行200米到目的地",
              road: "",
              step_action: "步行",
              walk_type: "终点步行"
            }
          ]
        }
      ]
    }
  };
}
