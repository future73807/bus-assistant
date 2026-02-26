'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, Navigation, MapPin, Volume2, RotateCcw, Settings as SettingsIcon, X, Bus, Footprints, Clock, ChevronRight, ChevronUp, ChevronDown, ArrowRight } from 'lucide-react'
import { Toaster } from 'sonner'

// 类型定义
interface Location {
  name: string
  address: string
  location: string
}

interface BusStop {
  name: string
}

interface BusStep {
  instruction: string
  distance: string
  duration: string
  line_name?: string
  line_id?: string
  via_num?: string
  via_stops?: BusStop[]
  departure_stop?: BusStop
  arrival_stop?: BusStop
  step_action?: string
  walk_type?: string
  action?: string // 为了兼容高德返回的数据结构
}

interface BusRoute {
  distance: string
  duration: string
  walking_distance: string
  cost?: {
    duration: string
    transit_fee: string
    walking_distance: string
  }
  steps: BusStep[]
}

interface Settings {
  amapKey?: string
  busKey?: string // Lolimi Bus API Key
}

// 状态类型
type AppState = 'idle' | 'listening_start' | 'confirming_start' | 'listening_end' | 'confirming_end' | 'searching' | 'showing_routes' | 'announcing'

export default function Home() {
  // 状态
  const [appState, setAppState] = useState<AppState>('idle')
  const [startPoint, setStartPoint] = useState<Location | null>(null)
  const [endPoint, setEndPoint] = useState<Location | null>(null)
  const [routes, setRoutes] = useState<BusRoute[]>([])
  const [selectedRoute, setSelectedRoute] = useState<number>(0)
  const [settings, setSettings] = useState<Settings>({})
  const [showSettings, setShowSettings] = useState(false)
  const [amapKeyInput, setAmapKeyInput] = useState('')
  const [busKeyInput, setBusKeyInput] = useState('')
  const [message, setMessage] = useState('请点击麦克风，说出您的出发地点')
  const [candidateLocations, setCandidateLocations] = useState<Location[]>([])
  const [isDemo, setIsDemo] = useState(false)
  const [currentAnnouncement, setCurrentAnnouncement] = useState('')
  const [announcementIndex, setAnnouncementIndex] = useState(0)
  const [isRecording, setIsRecording] = useState(false)
  const [city, setCity] = useState<string>('北京')
  const [currentLocation, setCurrentLocation] = useState<{ lng: number; lat: number } | null>(null)
  const [isAutoListen, setIsAutoListen] = useState(false)
  const [isInputExpanded, setIsInputExpanded] = useState(true)
  
  // 实时公交信息 (Map: routeIndex -> realtimeData)
  const [realtimeInfos, setRealtimeInfos] = useState<Record<number, any>>({})
  const realtimeIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // 键盘输入状态
  const [isEditingStart, setIsEditingStart] = useState(false)
  const [isEditingEnd, setIsEditingEnd] = useState(false)
  const [startInputValue, setStartInputValue] = useState('')
  const [endInputValue, setEndInputValue] = useState('')

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const announcementTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const appStateRef = useRef<AppState>(appState)
  const settingsRef = useRef<Settings>(settings)
  const startPointRef = useRef<Location | null>(startPoint)
  const endPointRef = useRef<Location | null>(endPoint)
  const routesRef = useRef<BusRoute[]>(routes)
  const selectedRouteRef = useRef<number>(selectedRoute)
  const cityRef = useRef<string>(city)
  const currentLocationRef = useRef<{ lng: number; lat: number } | null>(currentLocation)
  const isAutoListenRef = useRef(isAutoListen)

  // 保持 refs 同步
  useEffect(() => {
    appStateRef.current = appState
  }, [appState])

  useEffect(() => {
    currentLocationRef.current = currentLocation
  }, [currentLocation])
  
  useEffect(() => {
    settingsRef.current = settings
  }, [settings])
  
  useEffect(() => {
    startPointRef.current = startPoint
    if (startPoint) setStartInputValue(startPoint.address)
  }, [startPoint])
  
  useEffect(() => {
    endPointRef.current = endPoint
    if (endPoint) setEndInputValue(endPoint.address)
  }, [endPoint])
  
  useEffect(() => {
    routesRef.current = routes
  }, [routes])
  
  useEffect(() => {
    selectedRouteRef.current = selectedRoute
  }, [selectedRoute])

  useEffect(() => {
    cityRef.current = city
  }, [city])

  useEffect(() => {
    isAutoListenRef.current = isAutoListen
  }, [isAutoListen])

  // 浏览器原生TTS封装
  const speakNative = (text: string, rate: number = 0.8, onEnd?: () => void) => {
    if (!('speechSynthesis' in window)) {
      onEnd?.()
      return
    }

    // 取消之前的朗读
    speechSynthesis.cancel()
    
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'zh-CN'
    utterance.rate = rate
    
    // 尝试选择更好的中文语音（如 Google 普通话 或 Microsoft Xiaoxiao）
    const voices = speechSynthesis.getVoices()
    const preferredVoice = voices.find(v => 
      v.name.includes('Google') && v.lang.includes('zh') || 
      v.name.includes('Microsoft') && v.lang.includes('zh')
    )
    if (preferredVoice) {
      utterance.voice = preferredVoice
    }

    if (onEnd) {
      utterance.onend = onEnd
      utterance.onerror = onEnd
    }
    
    speechSynthesis.speak(utterance)
  }

  // TTS语音合成
  const speakText = async (text: string, onEnd?: () => void) => {
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, speed: 0.8 })
      })
      const data = await res.json()
      
      if (data.success && data.audio) {
        const audio = new Audio(`data:audio/mp3;base64,${data.audio}`)
        audioRef.current = audio
        if (onEnd) {
          audio.onended = onEnd
          audio.onerror = onEnd // 出错也视为结束，以免阻塞流程
        }
        await audio.play()
      } else {
        // 静默降级，不抛出错误
        console.warn('API TTS failed, fallback to native:', data.error)
        speakNative(text, 0.8, onEnd)
      }
    } catch (error) {
      console.warn('TTS request failed, fallback to native:', error)
      speakNative(text, 0.8, onEnd)
    }
  }

  // 播放语音并等待完成
  const speakTextAndWait = (text: string): Promise<void> => {
    return new Promise(async (resolve) => {
      // 避免 resolve 尚未被调用的情况下函数提前退出
      const safeResolve = () => {
         resolve();
      };

      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, speed: 0.7 })
        })
        const data = await res.json()
        
        if (data.success && data.audio) {
          const audio = new Audio(`data:audio/mp3;base64,${data.audio}`)
          audio.onended = () => safeResolve()
          audio.onerror = () => safeResolve()
          await audio.play()
        } else {
          // 静默降级，不抛出错误
          console.warn('API TTS failed, fallback to native:', data.error)
          speakNative(text, 0.7, safeResolve)
        }
      } catch (error) {
        console.warn('TTS request failed, fallback to native:', error)
        speakNative(text, 0.7, safeResolve)
      }
    })
  }

  // 获取当前城市
  const fetchCity = async (lng: number, lat: number) => {
    try {
      const res = await fetch('/api/amap/regeo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: `${lng},${lat}`,
          key: settingsRef.current.amapKey
        })
      })
      const data = await res.json()
      if (data.success && data.data.regeocode?.addressComponent?.city) {
        const cityName = data.data.regeocode.addressComponent.city
        // 高德返回的city可能是一个数组（为空时），或者字符串
        if (typeof cityName === 'string' && cityName.length > 0) {
          setCity(cityName)
          console.log('当前城市:', cityName)
        } else if (data.data.regeocode.addressComponent.province) {
            setCity(data.data.regeocode.addressComponent.province)
             console.log('当前城市(省份):', data.data.regeocode.addressComponent.province)
        }
      }
    } catch (error) {
      console.error('获取城市失败:', error)
    }
  }

  // 获取当前位置
  const getCurrentPosition = (): Promise<{ lng: number; lat: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('浏览器不支持定位'))
        return
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lng = position.coords.longitude
          const lat = position.coords.latitude
          // 获取到位置后，同时更新城市信息
          fetchCity(lng, lat)
          const newPos = { lng, lat }
          setCurrentLocation(newPos)
          resolve(newPos)
        },
        (error) => reject(error),
        { timeout: 10000 }
      )
    })
  }

  // 初始化时获取位置
  useEffect(() => {
    getCurrentPosition().catch(console.error)
  }, [])

  // 依次播报
  const playAnnouncements = async (announcements: string[]) => {
    for (let i = 0; i < announcements.length; i++) {
      if (appStateRef.current !== 'announcing') break
      
      setCurrentAnnouncement(announcements[i])
      setAnnouncementIndex(i)
      await speakTextAndWait(announcements[i])
      
      // 每条播报之间暂停一下
      await new Promise(resolve => {
        announcementTimeoutRef.current = setTimeout(resolve, 500)
      })
    }
    
    if (appStateRef.current === 'announcing') {
      // 播报结束后，保持 showing_routes 状态，但要清除播报动画
      setAppState('showing_routes')
      setCurrentAnnouncement('')
      // 自动开启麦克风，方便用户进行下一步操作（如重新规划等）
      if (isAutoListenRef.current) {
          // 稍微延迟一点，避免用户没反应过来
          setTimeout(() => {
             setMessage('请点击麦克风，说出您的指令')
             // 这里可以根据需求决定是否自动开启录音，或者只是提示
             // startRecording(8000) 
          }, 1000)
      }
    }
  }

  // 搜索路线
  const searchRoutes = async (endLocation?: Location) => {
    const origin = startPointRef.current?.location
    const destination = endLocation?.location || endPointRef.current?.location
    const key = settingsRef.current.amapKey
    
    if (!origin || !destination) return

    setAppState('searching')
    setMessage('正在规划路线...')

    try {
      const res = await fetch('/api/amap/bus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: origin,
          destination: destination,
          city: cityRef.current, // 使用当前城市
          key: key
        })
      })
      const data = await res.json()

      if (data.success && data.data.route?.transits?.length > 0) {
        setIsDemo(data.isDemo)
        setRoutes(data.data.route.transits.slice(0, 2)) // 只取前两个方案
        setRealtimeInfos({}) // 清除旧的实时信息
        setSelectedRoute(0)
        setAppState('showing_routes')
        setIsInputExpanded(false) // 找到路线后自动收起
        setMessage('')
        
        // 自动触发完整语音播报
        // 延迟一点点确保状态更新
        setTimeout(() => {
           startAnnouncement(data.data.route.transits[0], 0);
        }, 500);
        
      } else {
        setMessage('未找到合适的路线')
        await speakText('未找到合适的公交路线，请更换起点或终点', () => {
             if (isAutoListenRef.current) setTimeout(() => isAutoListenRef.current && startRecording(8000), 500)
        })
        if (!isAutoListenRef.current) setAppState('idle')
      }
    } catch (error) {
      console.error('路线规划失败:', error)
      setMessage('路线规划失败，请重试')
      await speakText('路线规划失败，请重试', () => {
           if (isAutoListenRef.current) setTimeout(() => isAutoListenRef.current && startRecording(8000), 500)
      })
      if (!isAutoListenRef.current) setAppState('idle')
    }
  }

  // 搜索位置
  const searchLocation = async (query: string, type: 'start' | 'end') => {
    if (!query.trim()) return

    try {
      setMessage(`正在搜索${type === 'start' ? '起点' : '终点'}...`)
      
      const res = await fetch('/api/amap/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: query,
          city: cityRef.current, // 使用当前城市
          location: currentLocationRef.current ? `${currentLocationRef.current.lng},${currentLocationRef.current.lat}` : undefined,
          key: settingsRef.current.amapKey
        })
      })
      const data = await res.json()

      if (data.success && data.data.geocodes?.length > 0) {
        setIsDemo(data.isDemo)
        
        if (data.data.geocodes.length === 1) {
          // 只有一个结果，直接使用
          const geo = data.data.geocodes[0]
          const location: Location = {
            name: geo.name || query, // 优先使用API返回的名称（POI名称）
            address: geo.formatted_address,
            location: geo.location
          }
          
          if (type === 'start') {
            setStartPoint(location)
            setStartInputValue(location.name) // 使用名称而不是地址
            setIsEditingStart(false)
            setMessage(`起点已设置：${location.name}`)
            await speakText(`起点已设置为${location.name}，请说出您的目的地`, () => {
              setAppState('listening_end')
              setMessage('请点击麦克风，说出您的目的地')
              if (isAutoListenRef.current) {
                setTimeout(() => isAutoListenRef.current && startRecording(8000), 500)
              }
            })
          } else {
            setEndPoint(location)
            setEndInputValue(location.name) // 使用名称而不是地址
            setIsEditingEnd(false)
            setMessage(`终点已设置：${location.name}`)
            await speakText(`终点已设置为${location.name}，正在为您规划路线`)
            // 开始规划路线
            searchRoutes(location)
          }
        } else {
          // 多个结果，让用户选择
          const locations: Location[] = data.data.geocodes.map((geo: { formatted_address: string; location: string; name?: string }) => ({
            name: geo.name || query,
            address: geo.formatted_address,
            location: geo.location
          }))
          setCandidateLocations(locations)
          
          if (type === 'start') {
            setAppState('confirming_start')
            setIsEditingStart(false)
          } else {
            setAppState('confirming_end')
            setIsEditingEnd(false)
          }
          
          setMessage(`找到多个位置，请点击选择`)
          await speakText(`找到${locations.length}个位置，请点击选择`, () => {
            if (isAutoListenRef.current) setTimeout(() => isAutoListenRef.current && startRecording(8000), 500)
          })
        }
      } else {
        const errorMsg = data.error || '未找到该位置，请重新输入'
        setMessage(errorMsg)
        await speakText(errorMsg, () => {
            if (isAutoListenRef.current) setTimeout(() => isAutoListenRef.current && startRecording(8000), 500)
        })
      }
    } catch (error) {
      console.error('搜索位置失败:', error)
      setMessage('搜索失败，请检查网络或Key配置')
      await speakText('搜索失败，请检查网络或配置', () => {
          if (isAutoListenRef.current) setTimeout(() => isAutoListenRef.current && startRecording(8000), 500)
      })
    }
  }

  // 处理语音输入
  const processVoiceInput = async (text: string) => {
    const normalizedText = text.trim()
    
    // 处理选择候选项的语音指令 (例如 "第一个", "选一", "第二个")
    if (appStateRef.current === 'confirming_start' || appStateRef.current === 'confirming_end') {
      const numberMap: Record<string, number> = {
        '一': 0, '1': 0, '壹': 0,
        '二': 1, '2': 1, '贰': 1,
        '三': 2, '3': 2, '叁': 2,
        '四': 3, '4': 3, '肆': 3,
        '五': 4, '5': 4, '伍': 4
      }
      
      let selectedIndex = -1
      
      // 检查是否包含数字关键词
      for (const key in numberMap) {
        if (normalizedText.includes(key)) {
          selectedIndex = numberMap[key]
          break
        }
      }
      
      if (selectedIndex !== -1 && selectedIndex < candidateLocations.length) {
        await selectCandidate(candidateLocations[selectedIndex], appStateRef.current === 'confirming_start' ? 'start' : 'end')
        return
      }
    }

    // 处理"我的位置"、"我家"等特殊地址
    let processedText = normalizedText
    if (normalizedText.includes('我的位置') || normalizedText.includes('当前位置') || normalizedText.includes('我在')) {
      // 尝试获取当前位置
      try {
        const position = await getCurrentPosition()
        processedText = `${position.lng},${position.lat}`
      } catch {
        // 如果无法获取位置，使用默认位置
        processedText = '当前位置'
      }
    }

    const currentState = appStateRef.current
    if (currentState === 'listening_start') {
      // 搜索起点
      await searchLocation(processedText, 'start')
    } else if (currentState === 'listening_end') {
      // 搜索终点
      await searchLocation(processedText, 'end')
    }
  }

  // 处理音频
  const processAudio = async (audioBlob: Blob) => {
    try {
      setMessage('正在识别语音...')
      
      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.webm')

      const res = await fetch('/api/asr', {
        method: 'POST',
        body: formData
      })
      const data = await res.json()

      if (data.success && data.text) {
        await processVoiceInput(data.text)
      } else {
        setMessage('语音识别失败，请重试')
        await speakText('语音识别失败，请重试', () => {
             if (isAutoListenRef.current) setTimeout(() => isAutoListenRef.current && startRecording(8000), 500)
        })
        if (!isAutoListenRef.current) setAppState('idle')
      }
    } catch (error) {
      console.error('处理音频失败:', error)
      setMessage('语音处理失败，请重试')
      await speakText('语音处理失败，请重试', () => {
          if (isAutoListenRef.current) setTimeout(() => isAutoListenRef.current && startRecording(8000), 500)
      })
      if (!isAutoListenRef.current) setAppState('idle')
    }
  }

  // 开始录音
  const startRecording = async (silenceTimeout: number = 5000) => {
    try {
      // 停止之前的录音
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop()
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data)
      }

      mediaRecorder.onstop = async () => {
        setIsRecording(false)
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        // 如果数据太小（可能是瞬间开启关闭），忽略
        if (audioBlob.size > 1000) {
            await processAudio(audioBlob)
        }
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
      
      // 自动停止
      setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          stopRecording()
        }
      }, silenceTimeout)
      
    } catch (error) {
      console.error('录音失败:', error)
      setMessage('无法访问麦克风，请检查权限设置')
      await speakText('无法访问麦克风，请检查权限设置')
    }
  }

  // 停止录音
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  // 加载设置
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/settings')
        const data = await res.json()
        if (data.success) {
          setSettings(data.settings)
          setAmapKeyInput(data.settings.amapKey || '')
          setBusKeyInput(data.settings.busKey || '')
        }
      } catch (error) {
        console.error('加载设置失败:', error)
      }
    }
    fetchSettings()
  }, [])

  // 保存设置
  const saveSettings = async () => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          amapKey: amapKeyInput,
          busKey: busKeyInput
        })
      })
      const data = await res.json()
      if (data.success) {
        setSettings({ 
          amapKey: amapKeyInput,
          busKey: busKeyInput
        })
        setShowSettings(false)
        await speakText('设置已保存')
      }
    } catch (error) {
      console.error('保存设置失败:', error)
    }
  }

  // 选择候选位置
  const selectCandidate = async (location: Location, type: 'start' | 'end') => {
    setCandidateLocations([])
    
    if (type === 'start') {
      setStartPoint(location)
      setStartInputValue(location.name) // 使用名称
      setMessage(`起点已设置：${location.name}`)
      await speakText(`起点已设置为${location.name}，请说出您的目的地`, () => {
        if (isAutoListenRef.current) setTimeout(() => isAutoListenRef.current && startRecording(8000), 500)
      })
      setAppState('listening_end')
      setMessage('请点击麦克风，说出您的目的地')
    } else {
      setEndPoint(location)
      setEndInputValue(location.name) // 使用名称
      setMessage(`终点已设置：${location.name}`)
      await speakText(`终点已设置为${location.name}，正在为您规划路线`)
      searchRoutes(location)
    }
  }

  // 获取实时公交信息
  const fetchRealtimeBus = async (station: string, city: string) => {
    try {
      const res = await fetch('/api/amap/realtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          station,
          city,
          key: settingsRef.current.amapKey,
          busKey: settingsRef.current.busKey
        })
      })
      const data = await res.json()
      if (data.success) {
        return data.data
      }
    } catch (error) {
      console.error('获取实时公交失败:', error)
    }
    return null
  }

  // 批量获取所有路线的实时公交信息
  const fetchAllRealtimeInfos = async (currentRoutes: BusRoute[]) => {
    if (!currentRoutes || currentRoutes.length === 0 || !cityRef.current) return;

    const newInfos: Record<number, any> = {};

    for (let i = 0; i < currentRoutes.length; i++) {
        const route = currentRoutes[i];
        const steps = route.steps || [];
        const firstBusStep = steps.find(s => s.line_name);

        if (firstBusStep) {
            const departureStop = firstBusStep.departure_stop?.name;
            const lineName = firstBusStep.line_name || '';

            if (departureStop) {
                // 尝试获取实时信息
                try {
                    const realtimeData = await fetchRealtimeBus(departureStop, cityRef.current);
                    let matchedLine = null;

                    if (realtimeData && realtimeData.lines) {
                        // 1. 尝试精确匹配 (包含关系)
                        matchedLine = realtimeData.lines.find((l: any) => 
                            lineName.includes(l.line_name) || l.line_name.includes(lineName.split('(')[0])
                        );

                        // 2. 如果没匹配到，尝试模糊匹配 (提取数字或核心标识)
                        if (!matchedLine) {
                            const getCoreName = (name: string) => {
                                const match = name.match(/([a-zA-Z0-9]+)/);
                                return match ? match[0] : name.replace(/\(.*\)/, '').replace('路', '').trim();
                            };
                            const targetCore = getCoreName(lineName);
                            
                            matchedLine = realtimeData.lines.find((l: any) => {
                                const sourceCore = getCoreName(l.line_name);
                                return sourceCore === targetCore;
                            });
                        }
                    }

                    if (matchedLine) {
                         newInfos[i] = matchedLine;
                    } else {
                        // 如果没有匹配到线路，但这是一个公交路线，我们仍然显示一个占位信息
                        // 这样用户知道我们尝试过获取，而不是什么都没有
                         newInfos[i] = { 
                             arrival_time: '-', 
                             station_distance: '-',
                             line_name: lineName,
                             desc: '暂无实时数据'
                         };

                        // 模拟数据 (Demo模式或无数据时)
                         if (isDemo || !settingsRef.current.amapKey) {
                             newInfos[i] = { 
                                 arrival_time: Math.floor(Math.random() * 10) + 1, 
                                 station_distance: Math.floor(Math.random() * 5) + 1,
                                 line_name: lineName
                             };
                         }
                    }
                } catch (e) {
                    console.error('Fetch realtime error', e);
                }
            }
        }
    }
    
    setRealtimeInfos(prev => ({ ...prev, ...newInfos }));
  }

  // 监听 routes 变化，启动定时刷新
  useEffect(() => {
    if (routes.length > 0) {
        // 立即获取一次
        fetchAllRealtimeInfos(routes);

        // 启动定时器 (每60秒刷新)
        realtimeIntervalRef.current = setInterval(() => {
            fetchAllRealtimeInfos(routes);
        }, 60000);
    } else {
        setRealtimeInfos({});
    }

    return () => {
        if (realtimeIntervalRef.current) {
            clearInterval(realtimeIntervalRef.current);
        }
    };
  }, [routes]);
  
  // 开始报站
  const startAnnouncement = async (routeData?: BusRoute, routeIndex?: number) => {
    // 允许传入 routeData，或者使用 ref 中的当前数据
    const route = routeData || routesRef.current[selectedRouteRef.current]
    if (!route) return

    // 获取对应的索引以查找实时信息
    const idx = routeIndex !== undefined 
        ? routeIndex 
        : (routeData ? routesRef.current.indexOf(routeData) : selectedRouteRef.current);
    
    setAppState('announcing')
    setAnnouncementIndex(0)
    
    const steps = route.steps || []
    
    // 构建报站内容 - 专为老年人优化：简洁、直接、语速慢
    const announcements: string[] = []
    
    // 1. 核心结论 (直接说坐什么车)
    const firstBus = steps.find(s => s.line_name)
    if (firstBus) {
        announcements.push(`请注意，您需要乘坐 ${firstBus.line_name?.replace(/\(.*\)/, '')}。`)
        announcements.push(`在 ${firstBus.departure_stop?.name} 上车。`)
    }

    // 2. 实时到站 (如果有)
    const currentRealtime = realtimeInfos[idx];
    if (currentRealtime && currentRealtime.arrival_time !== '-' && currentRealtime.status !== 0) {
         announcements.push(`车还有 ${currentRealtime.arrival_time} 分钟到站，请做好准备。`)
    } else {
         announcements.push(`请注意查看站牌信息。`)
    }

    // 3. 下车提醒
    if (firstBus) {
        announcements.push(`坐 ${firstBus.via_num} 站后，在 ${firstBus.arrival_stop?.name} 下车。`)
    }

    // 4. 换乘提醒 (如果有)
    const transferSteps = steps.filter((s, i) => i > 0 && s.line_name);
    if (transferSteps.length > 0) {
        announcements.push(`下车后，需要换乘 ${transferSteps.length} 次。`)
    }

    // 5. 结束语
    announcements.push(`祝您一路平安。`)
    
    // 依次播报
    playAnnouncements(announcements)
  }

  // 重置
  const handleReset = async () => {
    setIsAutoListen(false) // 停止自动录音
    if (announcementTimeoutRef.current) {
      clearTimeout(announcementTimeoutRef.current)
    }
    setAppState('idle')
    setStartPoint(null)
    setEndPoint(null)
    setRoutes([])
    setRealtimeInfos({})
    setSelectedRoute(0)
    setCandidateLocations([])
    setCurrentAnnouncement('')
    setStartInputValue('')
    setEndInputValue('')
    setIsEditingStart(false)
    setIsEditingEnd(false)
    setIsInputExpanded(true)
    setMessage('请点击麦克风，说出您的出发地点')
    await speakText('已重置，请说出您的出发地点')
  }

  // 麦克风按钮点击
  const handleMicClick = () => {
    if (appState === 'idle' || appState === 'listening_start' || appState === 'listening_end') {
      if (mediaRecorderRef.current?.state === 'recording') {
        // 用户手动停止，关闭自动录音
        setIsAutoListen(false)
        stopRecording()
        if (appState === 'listening_start') {
          setAppState('idle')
        } else if (appState === 'listening_end') {
          setAppState('listening_start')
        }
      } else {
        // 用户手动开启，开启自动录音
        setIsAutoListen(true)
        if (appState === 'idle') {
          setAppState('listening_start')
        }
        setMessage('正在聆听...')
        startRecording(8000) // 给予稍长一点的超时时间
      }
    }
  }

  // 处理键盘输入回车
  const handleKeyDown = (e: React.KeyboardEvent, type: 'start' | 'end') => {
    if (e.key === 'Enter') {
      const value = type === 'start' ? startInputValue : endInputValue
      if (value.trim()) {
        searchLocation(value, type)
      }
    }
  }

  // 格式化时间
  const formatDuration = (seconds: string) => {
    const mins = Math.floor(parseInt(seconds) / 60)
    if (mins < 60) return `${mins}分钟`
    const hours = Math.floor(mins / 60)
    const remainMins = mins % 60
    return `${hours}小时${remainMins}分钟`
  }

  // 格式化距离
  const formatDistance = (meters: string) => {
    const m = parseInt(meters)
    if (m < 1000) return `${m}米`
    return `${(m / 1000).toFixed(1)}公里`
  }

  return (
    <div className="min-h-screen bg-[#F7F9FC] font-sans text-gray-900 selection:bg-blue-100">
      <Toaster />
      
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md z-40 border-b border-gray-100">
        <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-gray-100 shadow-sm overflow-hidden">
              <Image src="/logo.svg" alt="Logo" width={32} height={32} className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-700 to-blue-500 bg-clip-text text-transparent">
              公交出行助手
            </h1>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="p-3 text-gray-400 hover:text-gray-600 transition-colors rounded-full hover:bg-gray-50"
          >
            <SettingsIcon size={28} />
          </button>
        </div>
      </header>

      <main className="pt-28 pb-40 px-4 max-w-lg mx-auto min-h-screen flex flex-col">
        {/* Demo Mode Alert */}
        <AnimatePresence>
          {isDemo && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800 text-base flex items-start gap-3"
            >
              <div className="mt-1"><RotateCcw size={20} /></div>
              <p>当前为演示模式。请在设置中配置高德 API Key 以获取实时数据。</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status Message */}
        <AnimatePresence mode="wait">
            {appState !== 'announcing' && routes.length === 0 && (
                <div className="text-center mb-10 mt-4 relative min-h-[3rem]">
                  <motion.h2 
                    key="message"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="text-4xl font-bold text-gray-800 leading-relaxed"
                  >
                    {message === '请点击麦克风，说出您的出发地点' ? (
                      <>
                        请点击麦克风，<br />说出您的出发地点
                      </>
                    ) : message === '请点击麦克风，说出您的目的地' ? (
                      <>
                        请点击麦克风，<br />说出您的目的地
                      </>
                    ) : message === '找到多个位置，请点击选择' ? (
                      <>
                        找到多个位置，<br />请点击选择
                      </>
                    ) : message}
                  </motion.h2>
                </div>
            )}
        </AnimatePresence>

        {/* Journey Card */}
        <AnimatePresence mode="wait">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`bg-white rounded-[2rem] shadow-sm border border-gray-100 mb-8 relative overflow-hidden transition-all duration-300 ${isInputExpanded ? 'p-8' : 'p-4'}`}
          >
            <div className={`absolute top-0 left-0 w-1.5 h-full bg-blue-500/10 transition-opacity ${isInputExpanded ? 'opacity-100' : 'opacity-0'}`} />
            
            {/* Toggle Button */}
            {routes.length > 0 && (
                <div 
                    className="absolute top-2 right-2 z-10 p-2 text-gray-400 hover:text-gray-600 cursor-pointer"
                    onClick={() => setIsInputExpanded(!isInputExpanded)}
                >
                    {isInputExpanded ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                </div>
            )}

            <div className="relative">
              {/* Collapsed View */}
              {!isInputExpanded && (
                  <div className="flex items-center justify-center gap-2 text-gray-600 font-bold text-lg" onClick={() => setIsInputExpanded(true)}>
                       <span className="truncate max-w-[120px]">{startPoint?.name || '起点'}</span>
                       <ArrowRight size={20} className="text-gray-400" />
                       <span className="truncate max-w-[120px]">{endPoint?.name || '终点'}</span>
                  </div>
              )}

              {/* Expanded View */}
              <AnimatePresence>
              {isInputExpanded && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="space-y-8"
                >
                  {/* Start Point */}
                  <div 
                    className="flex items-start gap-6 group cursor-pointer" 
                    onClick={() => {
                      setIsEditingStart(true)
                      setAppState('listening_start')
                    }}
                  >
                    <div className="mt-1 w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center shrink-0 border border-green-200 shadow-sm">
                      <span className="font-bold text-lg">起</span>
                    </div>
                    <div className="flex-1 min-w-0 pt-1">
                      <p className="text-sm text-gray-400 mb-2">出发地</p>
                      {isEditingStart ? (
                        <input
                          autoFocus
                          type="text"
                          value={startInputValue}
                          onChange={(e) => setStartInputValue(e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, 'start')}
                          onBlur={() => {
                            if (startInputValue.trim()) searchLocation(startInputValue, 'start')
                            setIsEditingStart(false)
                          }}
                          className="w-full text-2xl font-bold border-b-2 border-blue-500 outline-none bg-transparent"
                          placeholder="输入起点..."
                        />
                      ) : (
                        <p className={`font-bold text-2xl truncate ${!startPoint ? 'text-gray-300' : 'text-gray-900'}`}>
                          {startPoint?.address || '点击输入起点'}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Connector */}
                  <div className="absolute left-[22px] top-[50px] bottom-[50px] w-[3px] bg-gradient-to-b from-green-200 via-gray-200 to-red-200" />

                  {/* End Point */}
                  <div 
                    className="flex items-start gap-6 group cursor-pointer" 
                    onClick={() => {
                      setIsEditingEnd(true)
                      setAppState('listening_end')
                    }}
                  >
                    <div className="mt-1 w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0 border border-red-200 shadow-sm">
                      <span className="font-bold text-lg">终</span>
                    </div>
                    <div className="flex-1 min-w-0 pt-1">
                      <p className="text-sm text-gray-400 mb-2">目的地</p>
                      {isEditingEnd ? (
                        <input
                          autoFocus
                          type="text"
                          value={endInputValue}
                          onChange={(e) => setEndInputValue(e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, 'end')}
                          onBlur={() => {
                            if (endInputValue.trim()) searchLocation(endInputValue, 'end')
                            setIsEditingEnd(false)
                          }}
                          className="w-full text-2xl font-bold border-b-2 border-blue-500 outline-none bg-transparent"
                          placeholder="输入终点..."
                        />
                      ) : (
                        <p className={`font-bold text-2xl truncate ${!endPoint ? 'text-gray-300' : 'text-gray-900'}`}>
                          {endPoint?.address || '点击输入终点'}
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
              </AnimatePresence>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Candidate Locations */}
        <AnimatePresence>
          {candidateLocations.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="space-y-4"
            >
              {candidateLocations.map((loc, idx) => (
                <button
                  key={idx}
                  onClick={() => selectCandidate(loc, appState === 'confirming_start' ? 'start' : 'end')}
                  className="w-full bg-white hover:bg-blue-50 active:bg-blue-100 p-6 rounded-2xl text-left transition-all border border-gray-100 shadow-sm flex items-center gap-6 group"
                >
                  <div className="w-10 h-10 shrink-0 rounded-full bg-gray-100 text-gray-500 group-hover:bg-blue-200 group-hover:text-blue-700 flex items-center justify-center font-bold text-lg transition-colors">
                  {idx + 1}
                </div>
                  <div>
                    <p className="font-bold text-xl text-gray-800">{loc.name}</p>
                    <p className="text-base text-gray-500 mt-1">{loc.address}</p>
                  </div>
                  <ChevronRight className="ml-auto text-gray-300 group-hover:text-blue-400" size={24} />
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Route Results */}
        <AnimatePresence>
          {routes.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              {routes.map((route, idx) => (
                <motion.div
                  key={idx}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: idx * 0.1 }}
                  onClick={() => {
                    setSelectedRoute(idx)
                    startAnnouncement(route, idx)
                  }}
                  className={`relative overflow-hidden rounded-[2rem] transition-all duration-300 border-2 cursor-pointer ${
                    selectedRoute === idx 
                      ? 'bg-blue-600 border-blue-600 shadow-xl shadow-blue-200 text-white' 
                      : 'bg-white border-transparent hover:border-blue-100 shadow-sm text-gray-900'
                  }`}
                >
                  <div className="p-8">
                    <div className="flex justify-between items-start mb-8">
                      <div className="flex items-center gap-3">
                        {/* Left side empty to allow focus on Start/End points below */}
                      </div>
                      <div className="text-right flex flex-col items-end gap-2">
                          <div className="flex items-center gap-2">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                              selectedRoute === idx ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'
                            }`}>
                              方案 {idx + 1}
                            </span>
                            {idx === 0 && (
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                selectedRoute === idx ? 'bg-green-500/20 text-green-100' : 'bg-green-100 text-green-700'
                              }`}>
                                推荐
                              </span>
                            )}
                          </div>
                          <div>
                            <span className="text-4xl font-bold tabular-nums">
                              {Math.floor(parseInt(route.duration) / 60)}
                            </span>
                            <span className={`text-base ml-1.5 ${selectedRoute === idx ? 'text-white' : 'text-gray-500'}`}>分钟</span>
                          </div>
                      </div>
                    </div>

                    {/* Route Details: Boarding, Alighting, Line */}
                    <div className="mb-6 space-y-4">
                        {(() => {
                            const busSteps = route.steps?.filter(step => step.line_name) || [];
                            const firstBus = busSteps[0];
                            const lastBus = busSteps[busSteps.length - 1];
                            const transferCount = busSteps.length > 1 ? busSteps.length - 1 : 0;
                            
                            if (!firstBus) {
                                return (
                                    <div className="bg-gray-50 rounded-xl p-4 text-gray-500 text-center">
                                        <Footprints className="inline-block mr-2" size={20}/>
                                        全程步行
                                    </div>
                                );
                            }

                            return (
                                <>
                                    {/* Main Route Info */}
                                    <div className="flex flex-col gap-4">
                                        {/* Boarding */}
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-start gap-3">
                                                <div className="mt-1 w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center shrink-0 font-bold text-sm">
                                                    上
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-bold text-xl">{firstBus.departure_stop?.name || '起点'}</span>
                                                        <span className={`px-2 py-0.5 rounded text-sm font-bold ${selectedRoute === idx ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'}`}>
                                                            {firstBus.line_name?.replace(/\(.*\)/, '')}
                                                        </span>
                                                    </div>
                                                    <p className={`text-sm mt-0.5 ${selectedRoute === idx ? 'text-white/90' : 'text-gray-500'}`}>
                                                        乘坐 {firstBus.via_num} 站
                                                    </p>
                                                </div>
                                            </div>
                                            {appState === 'announcing' && selectedRoute === idx && (
                                                <div className="mr-2 mt-1">
                                                    <div className="relative flex items-center justify-center w-8 h-8 rounded-full">
                                                        <span className="absolute inset-0 rounded-full bg-green-400 opacity-40 animate-ping" />
                                                        <Volume2 size={24} className="text-green-300 relative z-10 animate-pulse" />
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Transfer Indicator if any */}
                                        {transferCount > 0 && (
                                            <div className="pl-3.5 ml-4 border-l-2 border-dashed border-gray-300 py-2">
                                                <div className={`text-sm font-bold flex items-center gap-1 ${selectedRoute === idx ? 'text-yellow-200' : 'text-amber-600'}`}>
                                                    <RotateCcw size={14} />
                                                    需要换乘 {transferCount} 次
                                                </div>
                                            </div>
                                        )}

                                        {/* Alighting */}
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-start gap-3">
                                                <div className="mt-1 w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0 font-bold text-sm">
                                                    下
                                                </div>
                                                <div>
                                                    <span className="font-bold text-xl">{lastBus.arrival_stop?.name || '终点'}</span>
                                                    <p className={`text-sm mt-0.5 ${selectedRoute === idx ? 'text-white/90' : 'text-gray-500'}`}>
                                                        {transferCount > 0 ? '到达目的地附近' : '到达目的地'}
                                                    </p>
                                                </div>
                                            </div>
                                            {/* Broadcasting Indicator Removed */}
                                        </div>
                                    </div>
                                </>
                            );
                        })()}
                    </div>

                    {/* Realtime Info Animation - Embedded in Card - Always Visible if Data Exists */}
                    <AnimatePresence>
                      {realtimeInfos[idx] && (
                        <motion.div
                          initial={{ height: 0, opacity: 0, marginBottom: 0 }}
                          animate={{ height: 'auto', opacity: 1, marginBottom: 32 }}
                          exit={{ height: 0, opacity: 0, marginBottom: 0 }}
                          className="overflow-hidden"
                        >
                          <div className={`backdrop-blur-md rounded-2xl p-4 border ${
                            selectedRoute === idx 
                              ? 'bg-white/20 border-white/30' 
                              : 'bg-blue-50 border-blue-100'
                          }`}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div className={`p-1.5 rounded-lg ${
                                  selectedRoute === idx ? 'bg-white/20' : 'bg-blue-100 text-blue-600'
                                }`}>
                                  <Bus size={16} className="animate-bounce" />
                                </div>
                                <span className={`text-sm font-bold ${
                                  selectedRoute === idx ? 'text-white' : 'text-blue-900'
                                }`}>实时公交</span>
                              </div>
                              <span className={`text-xs ${
                                selectedRoute === idx ? 'text-white/90' : 'text-blue-600'
                              }`}>
                                {realtimeInfos[idx].status === 0 ? '暂无数据' : '正在赶来'}
                              </span>
                            </div>
                            
                            {realtimeInfos[idx].status === 0 ? (
                                <div className="py-2">
                                    <p className={`text-lg font-bold ${selectedRoute === idx ? 'text-white/80' : 'text-gray-500'}`}>
                                        {/* 如果API返回了描述，显示描述；否则，如果配置了key但没数据，显示暂无数据；如果没配key，可能是Demo模式被覆盖了 */}
                                        {realtimeInfos[idx].desc || '暂无实时数据'}
                                    </p>
                                    {!settingsRef.current.amapKey && (
                                        <p className="text-xs mt-1 text-gray-400">
                                            (请在设置中配置API Key以获取实时数据)
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-end gap-2">
                                      <span className={`text-3xl font-bold ${
                                        selectedRoute === idx ? 'text-white' : 'text-blue-900'
                                      }`}>{realtimeInfos[idx].arrival_time}</span>
                                      <span className={`text-sm mb-1.5 ${
                                        selectedRoute === idx ? 'text-white/90' : 'text-blue-700'
                                      }`}>分钟</span>
                                      <span className={`text-sm mb-1.5 mx-1 ${
                                        selectedRoute === idx ? 'text-white/60' : 'text-blue-300'
                                      }`}>|</span>
                                      <span className={`text-3xl font-bold ${
                                        selectedRoute === idx ? 'text-white' : 'text-blue-900'
                                      }`}>{realtimeInfos[idx].station_distance}</span>
                                      <span className={`text-sm mb-1.5 ${
                                        selectedRoute === idx ? 'text-white/90' : 'text-blue-700'
                                      }`}>站</span>
                                    </div>
                                    <p className={`text-xs mt-2 truncate ${
                                      selectedRoute === idx ? 'text-white/80' : 'text-blue-600'
                                    }`}>
                                      车辆位置：{realtimeInfos[idx].line_name || '未知位置'}
                                    </p>
                                </>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Walking Distance Only (No Price) */}
                    <div className={`flex items-center gap-2 mb-6 opacity-80 ${selectedRoute === idx ? 'text-white' : 'text-gray-900'}`}>
                        <Footprints size={16} />
                        <span className="text-sm">步行 {formatDistance(route.walking_distance)}</span>
                    </div>

                    <div className={`pt-6 border-t ${selectedRoute === idx ? 'border-white/20' : 'border-gray-100'}`}>
                      {route.steps?.slice(0, 3).map((step, sIdx) => (
                        <div key={sIdx} className="flex items-center gap-4 py-2 text-base">
                          <div className={`w-2 h-2 rounded-full ${selectedRoute === idx ? 'bg-blue-300' : 'bg-gray-300'}`} />
                          <p className={`truncate ${selectedRoute === idx ? 'text-white/90' : 'text-gray-600'}`}>
                            {step.line_name ? `乘坐 ${step.line_name}` : step.instruction}
                          </p>
                        </div>
                      ))}
                      {(route.steps?.length || 0) > 3 && (
                         <p className={`text-sm mt-3 pl-6 ${selectedRoute === idx ? 'text-blue-200' : 'text-gray-400'}`}>
                           ...等 {route.steps?.length} 个步骤
                         </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>


      </main>

      {/* Floating Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-white via-white/95 to-transparent z-30 pointer-events-none">
        <div className="max-w-md mx-auto flex items-center justify-center gap-8 pointer-events-auto">
          {/* Reset Button (Left of Mic) */}
          <motion.button
            onClick={handleReset}
            className={`w-16 h-16 bg-white shadow-xl border border-gray-200 text-gray-600 rounded-full flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-all ${
              (startPoint || endPoint) ? 'opacity-100' : 'opacity-50'
            }`}
          >
            <RotateCcw size={28} />
          </motion.button>

          {/* Main Mic Button */}
          {(appState === 'idle' || appState === 'listening_start' || appState === 'listening_end' || appState === 'searching' || appState === 'showing_routes') && (
            <motion.button
              layoutId="mic-button"
              onClick={handleMicClick}
              className={`w-24 h-24 rounded-full shadow-2xl flex items-center justify-center transition-all relative ${
                isRecording
                  ? 'bg-red-500 text-white'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isRecording && (
                <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-75" />
              )}
              <Mic size={40} />
            </motion.button>
          )}

          {/* Announce Button Removed */}
        </div>
      </div>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[2rem] p-8 w-full max-w-sm shadow-2xl"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900">设置</h2>
                <button onClick={() => setShowSettings(false)} className="p-3 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200">
                  <X size={24} />
                </button>
              </div>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-base font-medium text-gray-700 mb-3">
                    高德地图 API Key (Web服务)
                  </label>
                  <input
                    type="text"
                    value={amapKeyInput}
                    onChange={(e) => setAmapKeyInput(e.target.value)}
                    placeholder="请输入 API Key"
                    className="w-full p-5 bg-gray-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl transition-all outline-none text-gray-900 text-lg"
                  />
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <label className="block text-base font-medium text-gray-700 mb-3">
                    公交数据 Key
                  </label>
                  <input
                      type="text"
                      value={busKeyInput}
                      onChange={(e) => setBusKeyInput(e.target.value)}
                      placeholder="请输入 Key"
                      className="w-full p-5 bg-gray-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl transition-all outline-none text-gray-900 text-lg"
                  />
                </div>
                


                <button
                  onClick={saveSettings}
                  className="w-full bg-blue-600 text-white font-bold py-5 rounded-2xl shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all text-lg"
                >
                  保存设置
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
