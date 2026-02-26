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
          // 修改为用户提供的正确接口地址: https://api.lolimi.cn/API/che/api
          const lolimiUrl = new URL("https://api.lolimi.cn/API/che/api");
          
          // 严格按照文档设置参数
          
          // city: 城市名称 (移除 "市" 后缀，例如 "福州市" -> "福州"，很多公交接口不识别带市的名称)
          const normalizedCity = city.endsWith('市') ? city.slice(0, -1) : city;
          lolimiUrl.searchParams.set("city", normalizedCity);
          
          // line: 站点名称 (注意：文档说line参数是站点名称)
          lolimiUrl.searchParams.set("line", station); 
          
          // key: 控制台key
          lolimiUrl.searchParams.set("key", busKey); 
          
          // type: 可选json/text默认text (显式设置为 json)
          lolimiUrl.searchParams.set("type", "json"); 
          
          // 打印请求参数以便调试
          console.log(`Requesting Lolimi API: city=${normalizedCity}, line=${station}`);

          try {
              const lRes = await fetch(lolimiUrl.toString(), {
                  headers: {
                      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                      'Accept': 'application/json'
                  }
              });
              
              if (!lRes.ok) {
                  // 如果是 404，可能是站点不存在，我们记录一下但不抛出严重错误，让流程继续到高德降级
                  console.warn(`Lolimi API returned ${lRes.status}: Station not found or API error`);
              } else {
                  // 尝试获取文本并手动解析，因为有时候API可能返回不规范
                  const text = await lRes.text();
                  let lData;
                  try {
                      lData = JSON.parse(text);
                  } catch (e) {
                      // 如果返回的不是JSON，通常是错误消息，如"获取数据失败"
                      console.warn("Lolimi API returned non-JSON message:", text.substring(0, 100));
                      // 这里不抛出异常，而是让它自然失败，进入后续的高德降级逻辑
                  }
                  
                  if (lData) {
                      // 处理非 200 状态码的业务逻辑错误
                      if (lData.code !== 200) {
                          console.warn(`Lolimi API Error: ${lData.code} - ${lData.msg || 'Unknown Error'}`);
                          // 如果是 429 (Too Many Requests) 或 401 (Invalid Key)，这些是关键错误，记录下来
                      } else if (lData.data && Array.isArray(lData.data)) {
                          // 成功获取数据
                          // 转换数据格式为前端可用
                          const realtimeInfo = lData.data.map((item: any) => {
                              // item: { lines: "49路", reachtime: "...", surplus: "35站", ... }
                              
                              // 解析 surplus: "35站" -> 35
                              let dist = 0;
                              if (item.surplus) {
                                  if (item.surplus.includes("即将")) {
                                      dist = 0;
                                  } else {
                                      const match = item.surplus.match(/(\d+)/);
                                      if (match) dist = parseInt(match[1]);
                                  }
                              }
                              
                              // 解析 travelTime: "42分" -> 42
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
              }
          } catch (e) {
              console.error("Lolimi API error:", e);
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
