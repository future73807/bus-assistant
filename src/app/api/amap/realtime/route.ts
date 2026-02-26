import { NextRequest, NextResponse } from "next/server";

// 实时公交查询API
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { city, station, key, busKey } = body; // busKey 是 api.lolimi.cn 的 key

    // 优先尝试使用 api.lolimi.cn 接口 (如果配置了 busKey)
    if (busKey) {
        // 构建请求URL
        // https://api.lolimi.cn/doc/gongjiaoche
        // 参数: city, line, key (如果不传key可能使用免费额度或者demo)
        // 注意：lolimi 接口是查"线路"的实时位置，而不是查"站点"的所有车。
        // 但我们可以用它来查指定线路在指定站点的到站情况。
        
        // 这里我们的输入是 station (站点名)，但我们也需要 line (线路名) 才能查 lolimi。
        // 目前前端传过来的参数主要是 station。
        // 为了适配，我们可能需要前端在调用时也把线路名传过来，或者我们先用高德查出线路，再查 lolimi。
        
        // 鉴于高德接口已经返回了该站点的所有线路列表 (lines)，
        // 我们可以遍历这些线路，去调用 lolimi 接口获取真实数据。
        // 但这样会产生大量请求。
        
        // 另一种方式：用户其实主要关心的是"规划路线"中的那一条线路。
        // 所以我们修改一下逻辑：
        // 如果 request body 里包含 line_name，我们就只查这一条线的实时数据。
        // 如果没有 line_name，我们还是先查高德获取列表，然后(可选)查第一条或者标记为"需点击刷新"。
    }
    
    // 兼容逻辑：如果是为了获取单个线路的实时数据 (前端改造后会传 line_name)
    const targetLine = body.line_name; 
    
    if (targetLine && busKey && city) {
         // 调用 Lolimi API
         const lolimiUrl = new URL("https://api.lolimi.cn/api/gongjiaoche");
         lolimiUrl.searchParams.set("city", city);
         lolimiUrl.searchParams.set("line", targetLine);
         // lolimiUrl.searchParams.set("key", busKey); // URL参数鉴权 (可选)
         
         try {
             const lRes = await fetch(lolimiUrl.toString(), {
                 headers: {
                     'Authorization': `Bearer ${busKey}` // 使用 Bearer Token 鉴权
                 }
             });
             const lData = await lRes.json();
             
             if (lData.code === 200 && lData.data) {
                 // ... (现有逻辑)
             }
         } catch (e) {
             console.error("Lolimi API error", e);
         }
     }

     if (busKey && city && station) {
          const lolimiUrl = new URL("https://api.lolimi.cn/api/gongjiaoche");
          lolimiUrl.searchParams.set("city", city);
          lolimiUrl.searchParams.set("line", station); // 传站点名
          // lolimiUrl.searchParams.set("key", busKey); // URL参数鉴权 (可选)
          
          const lRes = await fetch(lolimiUrl.toString(), {
              headers: {
                  'Authorization': `Bearer ${busKey}` // 使用 Bearer Token 鉴权
              }
          });
          const lData = await lRes.json();
          
          if (lData.code === 200 && lData.data && Array.isArray(lData.data)) {
              // ... (现有逻辑)
              // 转换数据格式为前端可用
              const realtimeInfo = lData.data.map((item: any) => {
                  // item: { lines: "49路", reachtime: "...", surplus: "35站", ... }
                  // 解析 surplus: "35站" -> 35
                  let dist = 0;
                  if (item.surplus) {
                      const match = item.surplus.match(/(\d+)/);
                      if (match) dist = parseInt(match[1]);
                      else if (item.surplus.includes("即将")) dist = 0;
                  }
                  
                  // 解析 reachtime 计算分钟数 (简单估算或直接显示)
                  // item.travelTime: "42分" -> 42
                  let time = 0;
                  if (item.travelTime) {
                       const match = item.travelTime.match(/(\d+)/);
                       if (match) time = parseInt(match[1]);
                  }
                  
                  return {
                      line_name: item.lines,
                      arrival_time: time,
                      station_distance: dist,
                      status: 1,
                      desc: item.surplus // 保存原始描述
                  };
              });
              
              return NextResponse.json({
                 success: true,
                 data: {
                     station_name: station,
                     lines: realtimeInfo
                 }
              });
          }
     }

    // Fallback to Amap (Station query only, mock realtime) if Lolimi fails or not configured
    // ... (Keep existing Amap logic as backup or for station name validation)
    
    if (!key) {
         // 如果既没有 busKey 也没有 amapKey，返回错误
         if (!busKey) {
             return NextResponse.json({ 
                success: false, 
                error: "请配置 API Key" 
              }, { status: 400 });
         }
         // 只有 busKey 但上面失败了
         return NextResponse.json({ 
            success: false, 
            error: "实时数据获取失败" 
          }, { status: 500 });
    }

    // 调用高德地图公交站点查询API (作为元数据补充或降级)
    const url = new URL("https://restapi.amap.com/v3/bus/stopname");
    url.searchParams.set("key", key);
    url.searchParams.set("keywords", station);
    if (city) {
      url.searchParams.set("city", city);
    }
    
    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status === "1" && data.busstops && data.busstops.length > 0) {
      // 找到最匹配的站点
      const stop = data.busstops[0];
      const buslines = stop.buslines || [];
      
      const realtimeInfo = buslines.map((line: any) => {
        // 如果配置了 busKey 但没获取到数据，显示无数据，而不是随机数
        if (busKey) {
             return {
                 line_name: line.name,
                 line_id: line.id,
                 arrival_time: '-', 
                 station_distance: '-', 
                 status: 0, 
                 desc: '暂无数据'
             };
        }

        // 默认行为：模拟数据 (仅演示用)
        const arrivalTime = Math.floor(Math.random() * 15) + 1;
        const stationDistance = Math.floor(Math.random() * 5) + 1;
        
        return {
          line_name: line.name,
          line_id: line.id,
          arrival_time: arrivalTime,
          station_distance: stationDistance,
          status: 1
        };
      });

      return NextResponse.json({
        success: true,
        data: {
            station_name: stop.name,
            lines: realtimeInfo
        }
      });
    }

    return NextResponse.json({ 
      success: false, 
      error: "未找到该站点信息" 
    }, { status: 404 });

  } catch (error) {
    console.error("实时公交查询错误:", error);
    return NextResponse.json({ 
      success: false, 
      error: "服务暂时不可用" 
    }, { status: 500 });
  }
}
